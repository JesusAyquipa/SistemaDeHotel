<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\HousekeepingTask;
use App\Models\User;
use App\Services\HousekeepingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Tareas de housekeeping (SHE-032). Rutas bajo /api/staff/housekeeping (admin | recepcionista).
 */
class HousekeepingController extends Controller
{
    private const RELATIONS = [
        'room:id,room_number,name,status',
        'assignee:id,name',
        'inspector:id,name',
        'booking:id,booking_code',
    ];

    public function __construct(private HousekeepingService $service)
    {
    }

    /**
     * GET /api/staff/housekeeping/tasks?status=&assigned_to=(id|me|none)&date=YYYY-MM-DD&room_id=&type=
     * Por defecto (sin status ni date) devuelve las tareas abiertas y las inspeccionadas hoy.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status'      => ['nullable', 'string', Rule::in(array_merge(HousekeepingTask::STATUSES, ['open', 'all']))],
            'type'        => ['nullable', 'string', Rule::in(HousekeepingTask::TYPES)],
            'assigned_to' => ['nullable', 'string', 'max:20', 'regex:/^(\d+|me|none)$/'],
            'date'        => ['nullable', 'date_format:Y-m-d'],
            'room_id'     => ['nullable', 'integer'],
        ], [
            'status.in'         => 'Estado de tarea no válido.',
            'type.in'           => 'Tipo de tarea no válido.',
            'assigned_to.regex' => 'El responsable debe ser un id, "me" o "none".',
            'date.date_format'  => 'La fecha debe tener el formato AAAA-MM-DD.',
        ]);

        $query = HousekeepingTask::query()->with(self::RELATIONS);

        $status = $validated['status'] ?? null;
        if ($status === 'open') {
            $query->open();
        } elseif ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        if (!empty($validated['date'])) {
            $query->whereDate('created_at', $validated['date']);
        } elseif (!$status) {
            $query->where(function ($q) {
                $q->whereIn('status', HousekeepingTask::OPEN_STATUSES)
                  ->orWhereDate('inspected_at', now()->toDateString());
            });
        }

        if (!empty($validated['type'])) {
            $query->where('type', $validated['type']);
        }
        if (!empty($validated['room_id'])) {
            $query->where('room_id', $validated['room_id']);
        }

        $assigned = $validated['assigned_to'] ?? null;
        if ($assigned === 'me') {
            $query->where('assigned_to', $request->user()->id);
        } elseif ($assigned === 'none') {
            $query->whereNull('assigned_to');
        } elseif ($assigned !== null) {
            $query->where('assigned_to', (int) $assigned);
        }

        $tasks = $query
            ->orderByRaw("CASE status WHEN 'in_progress' THEN 0 WHEN 'pending' THEN 1 WHEN 'done' THEN 2 ELSE 3 END")
            ->orderBy('created_at')
            ->limit(300)
            ->get();

        return response()->json(['tasks' => $tasks]);
    }

    /** POST /api/staff/housekeeping/tasks {room_id, type, notes?, assigned_to?} */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'room_id'     => ['required', 'integer', 'exists:rooms,id'],
            'type'        => ['required', 'string', Rule::in(HousekeepingTask::TYPES)],
            'notes'       => ['nullable', 'string', 'max:1000'],
            'assigned_to' => ['nullable', 'integer'],
        ], [
            'room_id.required' => 'Debe seleccionar una habitación.',
            'room_id.exists'   => 'La habitación seleccionada no existe.',
            'type.required'    => 'El tipo de tarea es obligatorio.',
            'type.in'          => 'El tipo debe ser: cleaning, inspection o maintenance.',
        ]);

        if (!empty($validated['assigned_to']) && ($error = $this->assignmentError($request, (int) $validated['assigned_to']))) {
            return $error;
        }

        $task = HousekeepingTask::create([
            'room_id'     => $validated['room_id'],
            'type'        => $validated['type'],
            'status'      => HousekeepingTask::STATUS_PENDING,
            'notes'       => $validated['notes'] ?? null,
            'assigned_to' => $validated['assigned_to'] ?? null,
            'created_by'  => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Tarea creada correctamente.',
            'task'    => $task->load(self::RELATIONS),
        ], 201);
    }

    /** PATCH /api/staff/housekeeping/tasks/{id}/assign {assigned_to: id|null} */
    public function assign(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'assigned_to' => ['present', 'nullable', 'integer'],
        ], [
            'assigned_to.present' => 'Debe indicar el responsable (o null para quitarlo).',
        ]);

        $task = HousekeepingTask::find($id);
        if (!$task) {
            return $this->notFound();
        }
        if ($task->status === HousekeepingTask::STATUS_INSPECTED) {
            return response()->json(['message' => 'No se puede reasignar una tarea ya inspeccionada.'], 422);
        }

        $assignee = $validated['assigned_to'] ?? null;
        if ($assignee !== null && ($error = $this->assignmentError($request, (int) $assignee))) {
            return $error;
        }
        if ($assignee === null && !$request->user()->hasRole('admin')
            && $task->assigned_to !== null && (int) $task->assigned_to !== (int) $request->user()->id) {
            return response()->json(['message' => 'Solo un administrador puede quitar la tarea a otro miembro del personal.'], 403);
        }

        $task->update(['assigned_to' => $assignee]);

        return response()->json([
            'message' => $assignee ? 'Tarea asignada correctamente.' : 'Tarea sin responsable.',
            'task'    => $task->load(self::RELATIONS),
        ]);
    }

    /** POST /api/staff/housekeeping/tasks/{id}/start */
    public function start(Request $request, int $id): JsonResponse
    {
        $task = HousekeepingTask::find($id);
        if (!$task) {
            return $this->notFound();
        }

        $task = $this->service->start($task, $request->user());

        return response()->json(['message' => 'Tarea iniciada.', 'task' => $task->load(self::RELATIONS)]);
    }

    /** POST /api/staff/housekeeping/tasks/{id}/finish */
    public function finish(int $id): JsonResponse
    {
        $task = HousekeepingTask::find($id);
        if (!$task) {
            return $this->notFound();
        }

        $task = $this->service->finish($task);

        return response()->json(['message' => 'Tarea finalizada. Pendiente de inspección.', 'task' => $task->load(self::RELATIONS)]);
    }

    /** POST /api/staff/housekeeping/tasks/{id}/inspect {notes?} */
    public function inspect(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate(['notes' => ['nullable', 'string', 'max:500']]);

        $task = HousekeepingTask::find($id);
        if (!$task) {
            return $this->notFound();
        }

        $result = $this->service->inspect($task, $request->user(), $validated['notes'] ?? null);
        $task = $result['task']->load(self::RELATIONS);

        $message = $result['room_released']
            ? "Tarea inspeccionada. La habitación {$task->room->room_number} quedó disponible."
            : 'Tarea inspeccionada.';

        return response()->json([
            'message'       => $message,
            'task'          => $task,
            'room_released' => $result['room_released'],
        ]);
    }

    // ------------------------------------------------------------------

    /**
     * El responsable debe ser personal activo. Un recepcionista solo puede asignarse a sí mismo.
     */
    private function assignmentError(Request $request, int $userId): ?JsonResponse
    {
        $actor = $request->user();
        if (!$actor->hasRole('admin') && $userId !== (int) $actor->id) {
            return response()->json(['message' => 'Solo un administrador puede asignar tareas a otro miembro del personal.'], 403);
        }

        $user = User::find($userId);
        if (!$user || !$user->is_active || !$user->hasAnyRole(Booking::STAFF_ROLES)) {
            return response()->json([
                'message' => 'El responsable debe ser un miembro activo del personal.',
                'errors'  => ['assigned_to' => ['El responsable debe ser un miembro activo del personal.']],
            ], 422);
        }

        return null;
    }

    private function notFound(): JsonResponse
    {
        return response()->json(['message' => 'Tarea no encontrada.'], 404);
    }
}
