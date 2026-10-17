<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\PasswordResetMail;
use App\Mail\WelcomeGuestMail;
use App\Models\Guest;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;
use Spatie\Permission\Models\Role;

class AuthController extends Controller
{
    /** Minutos de validez de un token de restablecimiento de contraseña. */
    private const RESET_TOKEN_TTL_MINUTES = 60;

    /** Mensaje genérico de "olvidé mi contraseña" (no revela si el correo existe). */
    private const FORGOT_PASSWORD_MESSAGE = 'Si el correo electrónico existe en nuestro sistema, recibirá un enlace para restablecer su contraseña.';

    /**
     * Autentica al usuario y devuelve un token Bearer.
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            // Nunca se registra la contraseña intentada
            ActivityLogger::log(
                'login_failed',
                'Intento de inicio de sesión fallido para ' . Str::limit((string) $credentials['email'], 200),
                $user,
                null,
                $user
            );

            throw ValidationException::withMessages([
                'email' => ['Las credenciales proporcionadas son incorrectas.'],
            ]);
        }

        if (!$user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Tu cuenta ha sido desactivada. Por favor, contacta al administrador.'],
            ]);
        }

        // Una sola sesión activa por usuario
        $user->tokens()->delete();

        $token = $user->createToken('auth_token')->plainTextToken;

        ActivityLogger::log('login', "Inicio de sesión de {$user->email}", $user, null, $user);

        return response()->json([
            'access_token' => $token,
            'token_type'   => 'Bearer',
            'user'         => $this->userPayload($user),
        ]);
    }

    /**
     * Registra un nuevo usuario cliente. Si ya existe una ficha de huésped
     * con el mismo correo (p. ej. reservó sin cuenta), se vincula a la cuenta.
     */
    public function register(Request $request): JsonResponse
    {
        $email = strtolower(trim((string) $request->input('email')));
        $existingGuest = $email !== ''
            ? Guest::whereRaw('LOWER(email) = ?', [$email])->first()
            : null;

        $validated = $request->validate([
            'name'            => 'required|string|max:255',
            'surname'         => 'required|string|max:255',
            'document_type'   => 'required|string|max:50',
            'document_number' => [
                'required', 'string', 'max:50',
                Rule::unique('guests', 'document_number')->ignore($existingGuest?->id),
            ],
            'birth_date'      => 'nullable|date|before_or_equal:today',
            'nationality'     => 'nullable|string|max:100',
            'phone'           => 'nullable|string|max:20',
            'email'           => 'required|string|email|max:255|unique:users,email',
            'password'        => 'required|string|min:8',
        ]);

        // La ficha existente ya pertenece a otra cuenta: no se puede reutilizar.
        if ($existingGuest && $existingGuest->user_id && User::whereKey($existingGuest->user_id)->exists()) {
            throw ValidationException::withMessages([
                'email' => ['Este correo electrónico ya está asociado a otra cuenta.'],
            ]);
        }

        $user = DB::transaction(function () use ($validated, $email, $existingGuest) {
            $user = User::create([
                'name'      => $validated['name'] . ' ' . $validated['surname'],
                'email'     => $email,
                'password'  => Hash::make($validated['password']),
                'is_active' => true,
            ]);

            $role = Role::firstOrCreate(['name' => 'cliente', 'guard_name' => 'web']);
            $user->assignRole($role);

            $guestData = [
                'name'            => $validated['name'],
                'surname'         => $validated['surname'],
                'document_type'   => $validated['document_type'],
                'document_number' => $validated['document_number'],
                'birth_date'      => $validated['birth_date'] ?? null,
                'nationality'     => $validated['nationality'] ?? null,
                'phone'           => $validated['phone'] ?? null,
                'email'           => $email,
                'user_id'         => $user->id,
            ];

            if ($existingGuest) {
                // Conservar datos previos si el formulario no los trae
                foreach (['birth_date', 'nationality', 'phone'] as $optional) {
                    if ($guestData[$optional] === null) {
                        unset($guestData[$optional]);
                    }
                }
                $existingGuest->update($guestData);
            } else {
                Guest::create($guestData);
            }

            return $user;
        });

        $token = $user->createToken('auth_token')->plainTextToken;

        try {
            Mail::to($user->email)->send(new WelcomeGuestMail($user));
        } catch (\Throwable $e) {
            Log::warning('No se pudo enviar el correo de bienvenida.', [
                'user_id'   => $user->id,
                'exception' => get_class($e),
            ]);
        }

        return response()->json([
            'access_token' => $token,
            'token_type'   => 'Bearer',
            'user'         => $this->userPayload($user),
        ], 201);
    }

    /**
     * Revoca el token actual.
     */
    public function logout(Request $request): JsonResponse
    {
        ActivityLogger::log('logout', "Cierre de sesión de {$request->user()->email}", $request->user(), null, $request->user());

        $token = $request->user()->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return response()->json([
            'message' => 'Cierre de sesión exitoso',
        ]);
    }

    /**
     * Datos del usuario autenticado.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->userPayload($request->user()),
        ]);
    }

    /**
     * Actualiza el perfil. Cambiar correo o contraseña exige `current_password`.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $emailChanging = $request->filled('email')
            && strtolower(trim((string) $request->input('email'))) !== strtolower($user->email);
        $passwordChanging = $request->filled('password');

        $rules = [
            'name'     => 'sometimes|nullable|string|max:255',
            'email'    => ['sometimes', 'nullable', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => 'sometimes|nullable|string|min:8',
            'image'    => 'sometimes|nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
        ];

        if ($emailChanging || $passwordChanging) {
            $rules['current_password'] = ['required', 'string', 'current_password:sanctum'];
        }

        $validated = $request->validate($rules, [
            'current_password.required'         => 'Debe ingresar su contraseña actual para cambiar el correo o la contraseña.',
            'current_password.current_password' => 'La contraseña actual es incorrecta.',
        ]);

        if (!empty($validated['name'])) {
            $user->name = $validated['name'];
        }

        if ($emailChanging) {
            $user->email = strtolower(trim($validated['email']));
        }

        if ($passwordChanging) {
            $user->password = Hash::make($validated['password']);
        }

        if ($request->hasFile('image')) {
            $this->deleteProfileImage($user->image_url);
            // Nombre aleatorio generado por Laravel (no se usa el nombre del cliente)
            $path = $request->file('image')->store('profiles', 'public');
            $user->image_url = '/storage/' . ltrim($path, '/');
        }

        $user->save();

        // Al cambiar la contraseña se cierran las demás sesiones
        if ($passwordChanging) {
            $currentToken = $user->currentAccessToken();
            $currentTokenId = $currentToken instanceof PersonalAccessToken ? $currentToken->getKey() : null;
            $user->tokens()
                ->when($currentTokenId, fn ($q) => $q->where('id', '!=', $currentTokenId))
                ->delete();
        }

        return response()->json([
            'message' => 'Perfil actualizado correctamente',
            'user'    => $this->userPayload($user),
        ]);
    }

    /**
     * Envía el enlace de restablecimiento. Siempre responde 200 con el mismo
     * mensaje, exista o no el correo, y aunque falle el envío del email.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $email = strtolower(trim((string) $request->input('email')));

        try {
            $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

            if ($user && $user->is_active) {
                $token = Str::random(64);

                DB::table('password_reset_tokens')->updateOrInsert(
                    ['email' => $user->email],
                    [
                        'token'      => Hash::make($token),
                        'created_at' => now(),
                    ]
                );

                Mail::to($user->email)->send(new PasswordResetMail($token, $user->email));
            }
        } catch (\Throwable $e) {
            Log::error('Error al procesar la solicitud de restablecimiento de contraseña.', [
                'exception' => get_class($e),
            ]);
        }

        return response()->json(['message' => self::FORGOT_PASSWORD_MESSAGE]);
    }

    /**
     * Restablece la contraseña usando el token (hasheado en BD, 60 min de validez).
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token'    => 'required|string',
            'email'    => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $invalid = response()->json(['message' => 'El token de recuperación es inválido o ha expirado.'], 400);

        $user = User::whereRaw('LOWER(email) = ?', [strtolower(trim($validated['email']))])->first();
        if (!$user) {
            return $invalid;
        }

        $record = DB::table('password_reset_tokens')->where('email', $user->email)->first();

        if (!$record || !Hash::check($validated['token'], $record->token)) {
            return $invalid;
        }

        $createdAt = $record->created_at ? Carbon::parse($record->created_at) : null;
        if (!$createdAt || $createdAt->addMinutes(self::RESET_TOKEN_TTL_MINUTES)->isPast()) {
            DB::table('password_reset_tokens')->where('email', $user->email)->delete();
            return $invalid;
        }

        $user->password = Hash::make($validated['password']);
        $user->save();

        DB::table('password_reset_tokens')->where('email', $user->email)->delete();
        // Invalidar todas las sesiones existentes
        $user->tokens()->delete();

        return response()->json(['message' => 'Su contraseña ha sido restablecida con éxito.']);
    }

    /**
     * Representación pública del usuario.
     */
    private function userPayload(User $user): array
    {
        return [
            'id'        => $user->id,
            'name'      => $user->name,
            'email'     => $user->email,
            'roles'     => $user->getRoleNames(),
            'image_url' => $user->image_url,
        ];
    }

    /**
     * Elimina la imagen de perfil anterior si está almacenada localmente.
     */
    private function deleteProfileImage(?string $imageUrl): void
    {
        if (!$imageUrl) {
            return;
        }

        try {
            if (str_starts_with($imageUrl, '/storage/profiles/')) {
                Storage::disk('public')->delete(Str::after($imageUrl, '/storage/'));
            } elseif (str_starts_with($imageUrl, '/profiles/')) {
                // Formato antiguo (archivos en public/profiles)
                $legacy = public_path('profiles/' . basename($imageUrl));
                if (is_file($legacy)) {
                    @unlink($legacy);
                }
            }
        } catch (\Throwable $e) {
            Log::warning('No se pudo eliminar la imagen de perfil anterior.', ['exception' => get_class($e)]);
        }
    }
}
