<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Invoice;
use App\Services\InvoiceService;
use App\Support\PeruDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Comprobantes internos (boleta/factura) — SHE-027. No se envían a SUNAT.
 */
class InvoiceController extends Controller
{
    private const PER_PAGE = 20;

    public function __construct(private InvoiceService $invoices)
    {
    }

    /**
     * POST /api/staff/bookings/{id}/invoice (admin | recepcionista)
     */
    public function store(Request $request, $id): JsonResponse
    {
        $booking = Booking::find($id);
        if (!$booking) {
            return response()->json(['message' => 'Reserva no encontrada.'], 404);
        }

        $validated = $request->validate([
            'type'                => ['required', Rule::in(Invoice::TYPES)],
            'customer_doc_type'   => ['required', Rule::in(Invoice::DOC_TYPES)],
            'customer_doc_number' => ['required', 'string', 'max:20'],
            'customer_name'       => ['required', 'string', 'max:200'],
            'customer_address'    => ['nullable', 'string', 'max:255'],
        ], [], [
            'type'                => 'tipo de comprobante',
            'customer_doc_type'   => 'tipo de documento',
            'customer_doc_number' => 'número de documento',
            'customer_name'       => 'nombre o razón social',
            'customer_address'    => 'dirección',
        ]);

        $docNumber = strtoupper(trim($validated['customer_doc_number']));

        if ($validated['type'] === Invoice::TYPE_FACTURA && $validated['customer_doc_type'] !== 'RUC') {
            throw ValidationException::withMessages([
                'customer_doc_type' => 'La factura requiere el RUC del cliente.',
            ]);
        }
        if (!PeruDocument::isValid($validated['customer_doc_type'], $docNumber)) {
            throw ValidationException::withMessages([
                'customer_doc_number' => PeruDocument::message($validated['customer_doc_type']),
            ]);
        }
        $validated['customer_doc_number'] = $docNumber;

        $invoice = $this->invoices->issue($booking, $validated, $request->user());

        return response()->json($this->present($invoice), 201);
    }

    /**
     * GET /api/staff/invoices — filtros: type, status, date_from, date_to, search.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'type'      => ['nullable', Rule::in(Invoice::TYPES)],
            'status'    => ['nullable', Rule::in([Invoice::STATUS_ISSUED, Invoice::STATUS_VOIDED])],
            'date_from' => ['nullable', 'date'],
            'date_to'   => ['nullable', 'date'],
            'search'    => ['nullable', 'string', 'max:100'],
        ]);

        $query = Invoice::with(['booking:id,booking_code,check_in,check_out,room_id,guest_id', 'issuer:id,name']);

        if ($request->filled('type')) {
            $query->where('type', $request->query('type'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('date_from')) {
            $query->whereDate('issued_at', '>=', $request->query('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('issued_at', '<=', $request->query('date_to'));
        }
        if ($request->filled('search')) {
            $term = trim((string) $request->query('search'));
            $like = '%' . str_replace(['%', '_'], ['\%', '\_'], $term) . '%';
            $query->where(function ($q) use ($term, $like) {
                $q->where('customer_name', 'like', $like)
                  ->orWhere('customer_doc_number', 'like', $like)
                  ->orWhereHas('booking', fn ($b) => $b->where('booking_code', 'like', $like));
                if (preg_match('/^([BF]\d{3})-?0*(\d+)$/i', $term, $m)) {
                    $q->orWhere(fn ($n) => $n->where('series', strtoupper($m[1]))->where('number', (int) $m[2]));
                }
            });
        }

        $page = $query->orderByDesc('issued_at')->orderByDesc('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        $payload = $page->toArray();
        $payload['hotel'] = Invoice::hotelData();

        return response()->json($payload);
    }

    /**
     * POST /api/staff/invoices/{id}/void (admin) {reason}
     */
    public function void(Request $request, $id): JsonResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']], [], ['reason' => 'motivo']);

        $invoice = Invoice::find($id);
        if (!$invoice) {
            return response()->json(['message' => 'Comprobante no encontrado.'], 404);
        }

        $invoice = $this->invoices->void($invoice, $validated['reason'], $request->user());

        return response()->json($this->present($invoice));
    }

    /**
     * GET /api/bookings/{code}/invoice (dueño o staff) — comprobante vigente; 404 si no hay.
     */
    public function showForBooking(Request $request, string $code): JsonResponse
    {
        $booking = Booking::with('guest')->where('booking_code', $code)->first();
        if (!$booking || !$booking->isAccessibleBy($request->user())) {
            return response()->json(['message' => 'Reserva no encontrada con el código proporcionado.'], 404);
        }

        $invoice = Invoice::where('booking_id', $booking->id)->active()->latest('issued_at')->first();
        if (!$invoice) {
            return response()->json(['message' => 'Aún no se ha emitido un comprobante para esta reserva.'], 404);
        }

        return response()->json($this->present($invoice));
    }

    private function present(Invoice $invoice): array
    {
        $invoice->loadMissing('booking:id,booking_code,check_in,check_out');

        return array_merge($invoice->toArray(), [
            'booking_code' => $invoice->booking?->booking_code,
            'hotel'        => Invoice::hotelData(),
        ]);
    }
}
