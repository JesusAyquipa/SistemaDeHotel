<?php

namespace App\Services\Booking;

use Illuminate\Http\JsonResponse;

/**
 * Error de negocio de reservas/pagos. Laravel invoca render() automáticamente
 * y responde con el formato estándar { "message": "..." } y el código HTTP indicado.
 */
class BookingException extends \RuntimeException
{
    public function __construct(
        string $message,
        private int $status = 422,
        private array $extra = []
    ) {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status;
    }

    public function extra(): array
    {
        return $this->extra;
    }

    /**
     * Error de negocio esperado: no se registra en el log de errores.
     */
    public function report(): void
    {
    }

    public function render(): JsonResponse
    {
        return response()->json(array_merge(['message' => $this->getMessage()], $this->extra), $this->status);
    }
}
