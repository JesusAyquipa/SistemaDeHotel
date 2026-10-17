<?php

namespace App\Models\Concerns;

use App\Models\ActivityLog;
use App\Services\ActivityLogger;
use Illuminate\Database\Eloquent\Model;

/**
 * Registra automáticamente en la bitácora la creación, modificación y
 * eliminación del modelo (con el diff old/new de los atributos modificados,
 * excluyendo timestamps, atributos ocultos y datos sensibles).
 */
trait LogsActivity
{
    /** Permite suspender el registro automático (p. ej. cuando se registra explícitamente). */
    protected static bool $activityLoggingDisabled = false;

    public static function bootLogsActivity(): void
    {
        static::created(function (Model $model) {
            if (static::$activityLoggingDisabled) {
                return;
            }
            ActivityLogger::log(
                'created',
                $model->activityLabel() . ' creado(a)',
                $model,
                ['new' => $model->activityAttributes($model->getAttributes())]
            );
        });

        static::updated(function (Model $model) {
            if (static::$activityLoggingDisabled) {
                return;
            }
            $new = $model->activityAttributes($model->getChanges());
            if (empty($new)) {
                return; // solo cambiaron timestamps o atributos ocultos
            }
            $old = [];
            foreach (array_keys($new) as $key) {
                $old[$key] = $model->getRawOriginal($key);
            }
            ActivityLogger::log(
                'updated',
                $model->activityLabel() . ' modificado(a): ' . implode(', ', array_keys($new)),
                $model,
                ['old' => $old, 'new' => $new]
            );
        });

        static::deleted(function (Model $model) {
            if (static::$activityLoggingDisabled) {
                return;
            }
            ActivityLogger::log(
                'deleted',
                $model->activityLabel() . ' eliminado(a)',
                $model,
                ['old' => $model->activityAttributes($model->getRawOriginal())]
            );
        });
    }

    /**
     * Ejecuta $callback sin registro automático (solo para la clase sobre la que se invoca).
     */
    public static function withoutActivityLogging(callable $callback): mixed
    {
        $previous = static::$activityLoggingDisabled;
        static::$activityLoggingDisabled = true;
        try {
            return $callback();
        } finally {
            static::$activityLoggingDisabled = $previous;
        }
    }

    /**
     * Etiqueta legible, p. ej. "Reserva BK-1234" o "Habitación 101".
     */
    public function activityLabel(): string
    {
        $type = class_basename($this);
        $label = ActivityLog::SUBJECT_LABELS[$type] ?? $type;

        $identifier = $this->getAttribute('booking_code')
            ?? $this->getAttribute('room_number')
            ?? $this->getAttribute('code')
            ?? null;

        return $identifier ? "{$label} {$identifier}" : "{$label} #{$this->getKey()}";
    }

    /**
     * Filtra atributos: sin timestamps, ocultos ni datos sensibles.
     */
    public function activityAttributes(array $attributes): array
    {
        $excluded = array_merge(['created_at', 'updated_at'], $this->getHidden());

        $clean = [];
        foreach ($attributes as $key => $value) {
            if (in_array($key, $excluded, true) || ActivityLogger::isSensitive((string) $key)) {
                continue;
            }
            $clean[$key] = $value;
        }

        return $clean;
    }
}
