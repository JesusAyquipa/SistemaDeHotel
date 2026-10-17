<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Bitácora de auditoría (SHE-021). Solo administradores.
 */
class ActivityLogController extends Controller
{
    private const PER_PAGE = 25;
    private const EXPORT_LIMIT = 5000;

    /**
     * GET /api/staff/activity-logs
     */
    public function index(Request $request): JsonResponse
    {
        $logs = $this->filteredQuery($request)
            ->with('user:id,name,email')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        return response()->json($logs);
    }

    /**
     * GET /api/staff/activity-logs/export — CSV (máx. 5000 filas).
     */
    public function export(Request $request): StreamedResponse
    {
        $query = $this->filteredQuery($request)
            ->with('user:id,name,email')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(self::EXPORT_LIMIT);

        $filename = 'bitacora-auditoria-' . now()->format('Ymd-His') . '.csv';

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            // BOM para que Excel reconozca UTF-8
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Fecha', 'Usuario', 'Correo', 'Acción', 'Entidad', 'ID entidad', 'Descripción', 'IP', 'Cambios']);

            foreach ($query->cursor() as $log) {
                fputcsv($out, array_map([$this, 'csvSafe'], [
                    optional($log->created_at)->format('Y-m-d H:i:s'),
                    $log->user->name ?? 'Sistema',
                    $log->user->email ?? '',
                    $log->action,
                    $log->subject_type ? (ActivityLog::SUBJECT_LABELS[$log->subject_type] ?? $log->subject_type) : '',
                    $log->subject_id,
                    $log->description,
                    $log->ip_address,
                    $log->changes ? json_encode($log->changes, JSON_UNESCAPED_UNICODE) : '',
                ]));
            }

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * Neutraliza la inyección de fórmulas en hojas de cálculo.
     */
    private function csvSafe($value): string
    {
        $value = (string) ($value ?? '');

        return ($value !== '' && in_array($value[0], ['=', '+', '-', '@', "\t", "\r"], true))
            ? "'" . $value
            : $value;
    }

    private function filteredQuery(Request $request): Builder
    {
        $filters = $request->validate([
            'user_id'      => ['nullable', 'integer'],
            'action'       => ['nullable', 'string', 'max:50'],
            'subject_type' => ['nullable', 'string', 'max:100'],
            'date_from'    => ['nullable', 'date'],
            'date_to'      => ['nullable', 'date', 'after_or_equal:date_from'],
            'search'       => ['nullable', 'string', 'max:255'],
        ], [
            'date_to.after_or_equal' => 'La fecha final debe ser igual o posterior a la fecha inicial.',
        ]);

        return ActivityLog::query()
            ->when($filters['user_id'] ?? null, fn (Builder $q, $v) => $q->where('user_id', $v))
            ->when($filters['action'] ?? null, fn (Builder $q, $v) => $q->where('action', $v))
            ->when($filters['subject_type'] ?? null, fn (Builder $q, $v) => $q->where('subject_type', class_basename($v)))
            ->when($filters['date_from'] ?? null, fn (Builder $q, $v) => $q->where('created_at', '>=', \Illuminate\Support\Carbon::parse($v)->startOfDay()))
            ->when($filters['date_to'] ?? null, fn (Builder $q, $v) => $q->where('created_at', '<=', \Illuminate\Support\Carbon::parse($v)->endOfDay()))
            ->when($filters['search'] ?? null, function (Builder $q, $v) {
                $q->where('description', 'like', '%' . addcslashes($v, '%_\\') . '%');
            });
    }
}
