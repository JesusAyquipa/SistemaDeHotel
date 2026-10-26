<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\CashRegisterSession;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * SHE-014 (apertura y cierre de caja por sesión) y SHE-015 (historial de cierres).
 */
class CashSessionTest extends TestCase
{
    use RefreshDatabase, BillingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpBilling();
    }

    private function openAs(User $user, float $amount = 100.00): CashRegisterSession
    {
        Sanctum::actingAs($user);
        $this->postJson('/api/staff/cash-sessions/open', ['opening_amount' => $amount])->assertStatus(201);

        return CashRegisterSession::where('user_id', $user->id)->latest('id')->firstOrFail();
    }

    private function payment(float $amount, string $method): Payment
    {
        $booking = $this->makeBooking(['guest_id' => $this->guest->id], 0);

        return Payment::create([
            'booking_id'       => $booking->id,
            'amount'           => $amount,
            'payment_method'   => $method,
            'status'           => Payment::STATUS_COMPLETED,
            'transaction_id'   => 'TX-CS-' . uniqid(),
            'gateway_provider' => 'simulation',
            'currency'         => 'PEN',
            'paid_at'          => now(),
        ]);
    }

    // ------------------------------------------------------------ apertura

    public function test_receptionist_and_admin_can_open_a_session(): void
    {
        Sanctum::actingAs($this->receptionist);
        $this->postJson('/api/staff/cash-sessions/open', ['opening_amount' => 150.5, 'notes' => 'Turno mañana'])
            ->assertStatus(201)
            ->assertJsonPath('session.status', 'open')
            ->assertJsonPath('session.user_id', $this->receptionist->id)
            ->assertJsonPath('session.opening_amount', '150.50');

        Sanctum::actingAs($this->admin);
        $this->postJson('/api/staff/cash-sessions/open', ['opening_amount' => 0])->assertStatus(201);

        $this->assertSame(2, CashRegisterSession::count());
    }

    public function test_second_open_for_same_user_returns_409_but_other_user_can_open(): void
    {
        $this->openAs($this->receptionist);

        Sanctum::actingAs($this->receptionist);
        $this->postJson('/api/staff/cash-sessions/open', ['opening_amount' => 50])
            ->assertStatus(409)
            ->assertJsonPath('message', 'Ya tienes una caja abierta');
        $this->assertSame(1, CashRegisterSession::where('user_id', $this->receptionist->id)->count());

        $this->openAs($this->admin);
    }

    public function test_open_validates_input(): void
    {
        Sanctum::actingAs($this->receptionist);

        $this->postJson('/api/staff/cash-sessions/open', [])->assertStatus(422)->assertJsonValidationErrors('opening_amount');
        $this->postJson('/api/staff/cash-sessions/open', ['opening_amount' => -1])->assertStatus(422);
        $this->postJson('/api/staff/cash-sessions/open', ['opening_amount' => 'abc'])->assertStatus(422);
        $this->postJson('/api/staff/cash-sessions/open', ['opening_amount' => 10, 'notes' => str_repeat('x', 501)])->assertStatus(422);
        $this->assertSame(0, CashRegisterSession::count());
    }

    public function test_cash_session_endpoints_require_staff_role(): void
    {
        $this->postJson('/api/staff/cash-sessions/open', ['opening_amount' => 10])->assertStatus(401);
        $this->getJson('/api/staff/cash-sessions/current')->assertStatus(401);

        Sanctum::actingAs($this->client);
        $this->postJson('/api/staff/cash-sessions/open', ['opening_amount' => 10])->assertStatus(403);
        $this->getJson('/api/staff/cash-sessions/current')->assertStatus(403);
        $this->getJson('/api/staff/cash-sessions')->assertStatus(403);
    }

    public function test_open_and_close_are_logged_without_secrets(): void
    {
        $session = $this->openAs($this->receptionist, 80);

        $log = ActivityLog::where('action', 'cash_open')->first();
        $this->assertNotNull($log);
        $this->assertSame('CashRegisterSession', $log->subject_type);
        $this->assertSame($session->id, (int) $log->subject_id);
        $this->assertSame($this->receptionist->id, (int) $log->user_id);

        Sanctum::actingAs($this->receptionist);
        $this->postJson('/api/staff/reports/close-register', ['cash_amount' => 80, 'voucher_amount' => 0])->assertOk();
        $this->assertNotNull(ActivityLog::where('action', 'cash_close')->first());
    }

    // ------------------------------------------------------------ current

    public function test_current_returns_null_session_when_none_open(): void
    {
        Sanctum::actingAs($this->receptionist);

        $this->getJson('/api/staff/cash-sessions/current')
            ->assertOk()
            ->assertJsonPath('session', null)
            ->assertJsonPath('summary.expected_cash', 0.0);
    }

    public function test_current_summary_splits_payments_by_method_since_opening(): void
    {
        // Pago anterior a la apertura: no cuenta
        $old = $this->payment(999, 'Efectivo');
        Payment::whereKey($old->id)->update(['created_at' => now()->subDay()]);

        $this->openAs($this->receptionist, 100);

        $this->payment(50, 'Efectivo');
        $this->payment(30.5, 'cash');
        $this->payment(200, 'card');
        $this->payment(70, 'mock');
        $this->payment(25, 'yape');
        // Pagos que no cuentan: fallido, pendiente
        $failed = $this->payment(500, 'Efectivo');
        $failed->update(['status' => Payment::STATUS_FAILED]);
        $pending = $this->payment(600, 'card');
        $pending->update(['status' => Payment::STATUS_PENDING]);

        Sanctum::actingAs($this->receptionist);
        $this->getJson('/api/staff/cash-sessions/current')
            ->assertOk()
            ->assertJsonPath('session.status', 'open')
            ->assertJsonPath('summary.opening_amount', 100.0)
            ->assertJsonPath('summary.cash_payments', 80.5)
            ->assertJsonPath('summary.card_payments', 270.0)
            ->assertJsonPath('summary.other_payments', 25.0)
            ->assertJsonPath('summary.expected_cash', 180.5);
    }

    public function test_current_only_shows_own_session(): void
    {
        $this->openAs($this->admin, 10);

        Sanctum::actingAs($this->receptionist);
        $this->getJson('/api/staff/cash-sessions/current')->assertOk()->assertJsonPath('session', null);
    }

    // ------------------------------------------------------------ cierre

    public function test_close_register_requires_an_open_session(): void
    {
        Sanctum::actingAs($this->receptionist);

        $this->postJson('/api/staff/reports/close-register', ['cash_amount' => 10, 'voucher_amount' => 0])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Debes abrir caja antes de cerrarla');
        $this->assertDatabaseCount('cash_register_closures', 0);
    }

    public function test_close_register_uses_opening_amount_and_session_payments(): void
    {
        $session = $this->openAs($this->receptionist, 100);
        $cash = $this->payment(50, 'Efectivo');
        $card = $this->payment(200, 'card');

        Sanctum::actingAs($this->receptionist);
        $response = $this->postJson('/api/staff/reports/close-register', [
            'cash_amount'    => 150,
            'voucher_amount' => 190,
            'notes'          => 'Faltan 10 en voucher',
            // El cliente no puede imponer el esperado
            'expected_amount' => 1,
            'difference'      => 0,
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('receipt.expected_amount', 350.0)
            ->assertJsonPath('receipt.counted_amount', 340.0)
            ->assertJsonPath('receipt.difference', -10.0)
            ->assertJsonPath('session.status', 'closed');

        $closure = $session->fresh()->closure;
        $this->assertNotNull($closure);
        $this->assertEquals($session->opened_at->timestamp, $closure->opened_at->timestamp);
        $this->assertEquals(150.0, $closure->totals['cash_expected']); // apertura + efectivo
        $this->assertEquals(200.0, $closure->totals['voucher_expected']);
        $this->assertSame($closure->id, $response->json('closure.id'));

        $this->assertSame('closed', $session->fresh()->status);
        $this->assertNotNull($session->fresh()->closed_at);
        $this->assertTrue((bool) $cash->fresh()->is_reconciled);
        $this->assertSame($closure->id, (int) $card->fresh()->cash_register_closure_id);
    }

    public function test_close_register_twice_fails_and_new_session_can_be_opened(): void
    {
        $this->openAs($this->receptionist, 20);

        Sanctum::actingAs($this->receptionist);
        $this->postJson('/api/staff/reports/close-register', ['cash_amount' => 20, 'voucher_amount' => 0])->assertOk();
        $this->postJson('/api/staff/reports/close-register', ['cash_amount' => 20, 'voucher_amount' => 0])
            ->assertStatus(422);

        $this->postJson('/api/staff/cash-sessions/open', ['opening_amount' => 5])->assertStatus(201);
    }

    public function test_close_register_validates_amounts(): void
    {
        $this->openAs($this->receptionist);

        $this->postJson('/api/staff/reports/close-register', ['cash_amount' => -1, 'voucher_amount' => 0])->assertStatus(422);
        $this->postJson('/api/staff/reports/close-register', ['voucher_amount' => 0])->assertStatus(422);
        $this->assertSame('open', CashRegisterSession::first()->status);
    }

    // ------------------------------------------------------------ SHE-015 historial

    private function closedSession(User $user, float $opening, float $cash, float $voucher): CashRegisterSession
    {
        $session = $this->openAs($user, $opening);
        Sanctum::actingAs($user);
        $this->postJson('/api/staff/reports/close-register', ['cash_amount' => $cash, 'voucher_amount' => $voucher])->assertOk();

        return $session->fresh();
    }

    public function test_history_is_admin_only(): void
    {
        $session = $this->closedSession($this->receptionist, 10, 10, 0);

        Sanctum::actingAs($this->receptionist);
        $this->getJson('/api/staff/cash-sessions')->assertStatus(403);
        $this->getJson("/api/staff/cash-sessions/{$session->id}")->assertStatus(403);
    }

    public function test_history_lists_sessions_with_totals_and_filters(): void
    {
        $a = $this->closedSession($this->receptionist, 100, 90, 0);   // esperado 100, contado 90 => -10
        $b = $this->closedSession($this->admin, 50, 60, 0);           // esperado 50, contado 60 => +10
        $open = $this->openAs($this->receptionist, 5);                // abierta

        Sanctum::actingAs($this->admin);

        $all = $this->getJson('/api/staff/cash-sessions')->assertOk();
        $all->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.per_page', 20)
            ->assertJsonPath('meta.totals.expected_amount', 150.0)
            ->assertJsonPath('meta.totals.counted_amount', 150.0)
            ->assertJsonPath('meta.totals.difference', 0.0);
        $this->assertCount(3, $all->json('data'));
        $first = collect($all->json('data'))->firstWhere('id', $a->id);
        $this->assertSame(['id' => $this->receptionist->id, 'name' => $this->receptionist->name], $first['user']);
        $this->assertSame('closed', $first['status']);
        $this->assertEquals(-10, $first['difference']);
        $this->assertEquals(100, $first['opening_amount']);

        $openItem = collect($all->json('data'))->firstWhere('id', $open->id);
        $this->assertSame('open', $openItem['status']);
        $this->assertNull($openItem['expected_amount']);
        $this->assertNull($openItem['closed_at']);

        // Filtros
        $this->getJson('/api/staff/cash-sessions?user_id=' . $this->admin->id)
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('meta.totals.difference', 10.0);
        $this->getJson('/api/staff/cash-sessions?status=open')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/staff/cash-sessions?status=closed')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson('/api/staff/cash-sessions?date_from=' . now()->addDay()->toDateString())
            ->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/staff/cash-sessions?date_from=' . now()->toDateString() . '&date_to=' . now()->toDateString())
            ->assertOk()->assertJsonPath('meta.total', 3);
        $this->getJson('/api/staff/cash-sessions?status=bogus')->assertStatus(422);
        $this->getJson('/api/staff/cash-sessions?date_from=2026-02-10&date_to=2026-02-01')->assertStatus(422);
        unset($b);
    }

    public function test_history_is_paginated_by_20(): void
    {
        for ($i = 0; $i < 21; $i++) {
            CashRegisterSession::create([
                'user_id' => $this->receptionist->id, 'opened_at' => now()->subMinutes($i + 1),
                'opening_amount' => 1, 'status' => 'closed', 'closed_at' => now(),
            ]);
        }

        Sanctum::actingAs($this->admin);
        $page1 = $this->getJson('/api/staff/cash-sessions')->assertOk();
        $this->assertCount(20, $page1->json('data'));
        $page1->assertJsonPath('meta.last_page', 2);
        $this->assertCount(1, $this->getJson('/api/staff/cash-sessions?page=2')->json('data'));
    }

    public function test_history_detail_includes_session_payments(): void
    {
        $session = $this->openAs($this->receptionist, 100);
        $this->payment(75, 'Efectivo');
        $this->payment(125, 'card');
        Sanctum::actingAs($this->receptionist);
        $this->postJson('/api/staff/reports/close-register', ['cash_amount' => 175, 'voucher_amount' => 125])->assertOk();

        Sanctum::actingAs($this->admin);
        $detail = $this->getJson("/api/staff/cash-sessions/{$session->id}")->assertOk()
            ->assertJsonPath('session.id', $session->id)
            ->assertJsonPath('session.status', 'closed')
            ->assertJsonPath('session.expected_amount', 300.0);

        $this->assertCount(2, $detail->json('payments'));
        $this->assertEqualsCanonicalizing([75.0, 125.0], array_map('floatval', array_column($detail->json('payments'), 'amount')));
        $this->assertArrayHasKey('booking_code', $detail->json('payments.0'));
    }

    public function test_history_detail_of_open_session_and_missing_id(): void
    {
        $session = $this->openAs($this->receptionist, 10);
        $this->payment(40, 'Efectivo');

        Sanctum::actingAs($this->admin);
        $this->getJson("/api/staff/cash-sessions/{$session->id}")
            ->assertOk()->assertJsonPath('session.status', 'open')->assertJsonCount(1, 'payments');
        $this->getJson('/api/staff/cash-sessions/99999')->assertStatus(404);
    }
}
