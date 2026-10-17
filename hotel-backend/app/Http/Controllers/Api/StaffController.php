<?php

namespace App\Http\Controllers\Api;

use App\Services\ActivityLogger;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class StaffController extends Controller
{
    /**
     * Listar todas las cuentas del personal con sus roles y estado.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => 'nullable|string|max:100',
            'role'   => 'nullable|string|in:admin,recepcionista,cliente',
        ]);

        $query = User::with('roles');

        // Filtro por búsqueda (nombre o email)
        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Filtro por rol
        if (!empty($filters['role'])) {
            $query->role($filters['role']);
        }

        $staff = $query->latest()->get()->map(function ($user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_active' => (bool) $user->is_active,
                'roles' => $user->getRoleNames(),
                'primary_role' => $user->getRoleNames()->first() ?? 'sin_rol',
                'created_at' => $user->created_at->format('Y-m-d H:i:s'),
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $staff,
        ]);
    }

    /**
     * Crear una nueva cuenta de personal.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'role' => 'required|string|in:admin,recepcionista,cliente',
            'is_active' => 'boolean',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'is_active' => $validated['is_active'] ?? true,
        ]);

        $user->assignRole($validated['role']);

        ActivityLogger::log(
            'role_change',
            "Cuenta {$user->email} creada con rol {$validated['role']}",
            $user,
            ['old' => ['role' => null], 'new' => ['role' => $validated['role']]]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Cuenta de personal creada exitosamente.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_active' => (bool) $user->is_active,
                'primary_role' => $validated['role'],
            ],
        ], 201);
    }

    /**
     * Mostrar los detalles de una cuenta de personal.
     */
    public function show(string $id): JsonResponse
    {
        $user = User::with('roles')->findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_active' => (bool) $user->is_active,
                'roles' => $user->getRoleNames(),
                'primary_role' => $user->getRoleNames()->first() ?? 'sin_rol',
                'created_at' => $user->created_at->format('Y-m-d H:i:s'),
            ],
        ]);
    }

    /**
     * Editar datos y rol de una cuenta de personal.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => 'nullable|string|min:8',
            'role' => 'required|string|in:admin,recepcionista,cliente',
            'is_active' => 'boolean',
        ]);

        // Un administrador no puede quitarse a sí mismo el rol admin ni desactivarse
        if ((int) $request->user()->id === (int) $user->id) {
            if ($validated['role'] !== 'admin') {
                return response()->json([
                    'message' => 'No puede quitarse a sí mismo el rol de administrador.',
                ], 422);
            }
            if (array_key_exists('is_active', $validated) && !$validated['is_active']) {
                return response()->json([
                    'message' => 'No puede desactivar su propia cuenta.',
                ], 422);
            }
        }

        $userData = [
            'name' => $validated['name'],
            'email' => $validated['email'],
        ];

        if (!empty($validated['password'])) {
            $userData['password'] = Hash::make($validated['password']);
        }

        if (isset($validated['is_active'])) {
            $userData['is_active'] = $validated['is_active'];
        }

        $oldRole = $user->getRoleNames()->first();

        $user->update($userData);
        $user->syncRoles([$validated['role']]);

        if ($oldRole !== $validated['role']) {
            ActivityLogger::log(
                'role_change',
                "Rol de {$user->email} cambiado de " . ($oldRole ?? 'sin rol') . " a {$validated['role']}",
                $user,
                ['old' => ['role' => $oldRole], 'new' => ['role' => $validated['role']]]
            );
        }

        if (!$user->is_active) {
            $user->tokens()->delete();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Cuenta de personal actualizada exitosamente.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_active' => (bool) $user->is_active,
                'primary_role' => $validated['role'],
            ],
        ]);
    }

    /**
     * Alternar el estado (Activar / Desactivar) de una cuenta de personal.
     */
    public function toggleStatus(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ((int) $request->user()->id === (int) $user->id) {
            return response()->json([
                'message' => 'No puede desactivar su propia cuenta.',
            ], 422);
        }
        $user->is_active = !$user->is_active;
        $user->save();

        // Una cuenta desactivada pierde inmediatamente sus sesiones
        if (!$user->is_active) {
            $user->tokens()->delete();
        }

        $action = $user->is_active ? 'activada' : 'desactivada';

        return response()->json([
            'status' => 'success',
            'message' => "La cuenta de {$user->name} fue {$action} exitosamente.",
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'is_active' => (bool) $user->is_active,
            ],
        ]);
    }
}
