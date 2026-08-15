<?php

namespace App\Http\Controllers\Api;

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
        $query = User::with('roles');

        // Filtro por búsqueda (nombre o email)
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Filtro por rol
        if ($request->has('role') && !empty($request->role)) {
            $query->role($request->role);
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
            'password' => 'required|string|min:6',
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
            'password' => 'nullable|string|min:6',
            'role' => 'required|string|in:admin,recepcionista,cliente',
            'is_active' => 'boolean',
        ]);

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

        $user->update($userData);
        $user->syncRoles([$validated['role']]);

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
    public function toggleStatus(string $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $user->is_active = !$user->is_active;
        $user->save();

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
