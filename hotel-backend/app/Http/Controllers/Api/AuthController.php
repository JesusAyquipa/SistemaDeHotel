<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use App\Mail\WelcomeGuestMail;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use App\Models\User;
use App\Mail\PasswordResetMail;

class AuthController extends Controller
{
    /**
     * Authenticate user and return token
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
            // optionally 'device_name'
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            throw ValidationException::withMessages([
                'email' => ['Las credenciales proporcionadas son incorrectas.'],
            ]);
        }

        $user = Auth::user();

        if (!$user->is_active) {
            $request->user()->currentAccessToken()?->delete(); // Por si acaso
            throw ValidationException::withMessages([
                'email' => ['Tu cuenta ha sido desactivada. Por favor, contacta al administrador.'],
            ]);
        }

        // Eliminar tokens anteriores (opcional, para mantener una sola sesión)
        $user->tokens()->delete();

        // Crear nuevo token
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'roles' => $user->getRoleNames(),
                'image_url' => $user->image_url,
            ]
        ]);
    }

    /**
     * Register a new guest user
     */
    public function register(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'surname' => 'required|string|max:255',
            'document_type' => 'required|string',
            'document_number' => 'required|string|unique:guests,document_number',
            'birth_date' => 'nullable|date',
            'nationality' => 'nullable|string',
            'phone' => 'nullable|string',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
        ]);

        $user = User::create([
            'name' => $request->name . ' ' . $request->surname,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'is_active' => true,
        ]);

        // Assumes spatie permission is installed, assign 'cliente' role if exists, otherwise create it or skip
        try {
            $user->assignRole('cliente');
        } catch (\Exception $e) {
            // Do nothing if role doesn't exist
        }

        \App\Models\Guest::create([
            'name' => $request->name,
            'surname' => $request->surname,
            'document_type' => $request->document_type,
            'document_number' => $request->document_number,
            'birth_date' => $request->birth_date,
            'nationality' => $request->nationality,
            'phone' => $request->phone,
            'email' => $request->email,
            'user_id' => $user->id,
        ]);
        $token = $user->createToken('auth_token')->plainTextToken;

        // Enviar correo de bienvenida
        try {
            Mail::to($user->email)->send(new WelcomeGuestMail($user));
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('No se pudo enviar correo de bienvenida: ' . $e->getMessage());
        }

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'roles' => $user->getRoleNames(),
            ]
        ], 201);
    }

    /**
     * Logout user (Revoke the token)
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Cierre de sesión exitoso'
        ]);
    }

    /**
     * Get authenticated user info
     */
    public function me(Request $request)
    {
        $user = $request->user();
        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'roles' => $user->getRoleNames(),
                'image_url' => $user->image_url,
            ]
        ]);
    }

    /**
     * Update user profile
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|string|email|max:255|unique:users,email,' . $user->id,
            'password' => 'sometimes|nullable|string|min:8',
            'image' => 'sometimes|nullable|image|max:5120',
        ]);

        if ($request->has('name') && !empty($request->name)) {
            $user->name = $request->name;
        }

        if ($request->has('email') && !empty($request->email)) {
            $user->email = $request->email;
        }

        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
        }

        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $filename = time() . '_' . $file->getClientOriginalName();
            $file->move(public_path('profiles'), $filename);
            $user->image_url = '/profiles/' . $filename;
        }

        $user->save();

        return response()->json([
            'message' => 'Perfil actualizado correctamente',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'roles' => $user->getRoleNames(),
                'image_url' => $user->image_url,
            ]
        ]);
    }

    /**
     * Send password reset link
     */
    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email'
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            // For security, do not reveal if the email exists or not
            return response()->json(['message' => 'Si el correo electrónico existe en nuestro sistema, recibirá un enlace para restablecer su contraseña.'], 200);
        }

        $token = Str::random(60);

        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $request->email],
            [
                'token' => $token,
                'created_at' => now()
            ]
        );

        try {
            Mail::to($user->email)->send(new PasswordResetMail($token, $user->email));
        } catch (\Exception $e) {
            \Log::error('Error sending password reset email: ' . $e->getMessage());
            return response()->json(['message' => 'Hubo un error al intentar enviar el correo de recuperación. Intente más tarde.'], 500);
        }

        return response()->json([
            'message' => 'Si el correo electrónico existe en nuestro sistema, recibirá un enlace para restablecer su contraseña.'
        ]);
    }

    /**
     * Reset the user's password
     */
    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $resetToken = DB::table('password_reset_tokens')
                        ->where('email', $request->email)
                        ->where('token', $request->token)
                        ->first();

        if (!$resetToken) {
            return response()->json(['message' => 'El token de recuperación es inválido o ha expirado.'], 400);
        }

        // Check expiration (e.g., 60 minutes)
        if (now()->subMinutes(60)->isAfter($resetToken->created_at)) {
            DB::table('password_reset_tokens')->where('email', $request->email)->delete();
            return response()->json(['message' => 'El token de recuperación ha expirado.'], 400);
        }

        $user = User::where('email', $request->email)->first();
        
        if (!$user) {
            return response()->json(['message' => 'No se encontró un usuario con ese correo electrónico.'], 404);
        }

        $user->password = Hash::make($request->password);
        $user->save();

        // Delete the token
        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        return response()->json(['message' => 'Su contraseña ha sido restablecida con éxito.']);
    }
}