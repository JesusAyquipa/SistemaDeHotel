<?php

namespace Tests\Feature;

use App\Mail\RefundApprovedMail;
use App\Models\Payment;
use App\Services\RefundPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RefundManagementTest extends TestCase
{
    use RefreshDatabase, BillingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpBilling();
    }

    private function pendingRefund(float $amount = 150.00): Payment
    {
        $booking = $this->makeBooking();

        return RefundPolicy::recordRefund($booking, $amount, 'Cancelación de reserva');
    }

    public function test_admin_lists_pending_and_processed_refunds(): void
    {
        $pending = $this->pendingRefund();
        Sanctum::actingAs($this->admin);

        $this->getJson('/api/staff/refunds')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $pending->id)
            ->assertJsonPath('data.0.amount', 150)
            ->assertJsonPath('data.0.booking.guest.email', 'cliente@example.com');

        $this->getJson('/api/staff/refunds?status=refunded')->assertOk()->assertJsonPath('total', 0);
        $this->getJson('/api/staff/refunds?status=bogus')->assertStatus(422);
    }

    public function test_admin_approves_refund_sends_mail_and_logs(): void
    {
        Mail::fake();
        $refund = $this->pendingRefund();
        Sanctum::actingAs($this->admin);

        $this->postJson("/api/staff/refunds/{$refund->id}/approve", ['method' => 'bitcoin'])->assertStatus(422);

        $this->postJson("/api/staff/refunds/{$refund->id}/approve", ['method' => 'transfer', 'reference' => 'OP-998877'])
            ->assertOk()
            ->assertJsonPath('refund.status', 'refunded')
            ->assertJsonPath('refund.refund_method', 'transfer')
            ->assertJsonPath('refund.refund_reference', 'OP-998877');

        $this->assertDatabaseHas('payments', ['id' => $refund->id, 'status' => 'refunded']);
        $this->assertDatabaseHas('activity_logs', ['action' => 'refund_approved', 'subject_id' => $refund->id]);
        Mail::assertQueued(RefundApprovedMail::class, fn ($m) => $m->hasTo('cliente@example.com') && $m->amount === 150.0);

        // Ya procesado
        $this->postJson("/api/staff/refunds/{$refund->id}/approve", ['method' => 'cash'])->assertStatus(409);
        $this->getJson('/api/staff/refunds?status=refunded')->assertJsonPath('total', 1);
    }

    public function test_admin_rejects_refund_with_reason(): void
    {
        Mail::fake();
        $refund = $this->pendingRefund();
        Sanctum::actingAs($this->admin);

        $this->postJson("/api/staff/refunds/{$refund->id}/reject", [])->assertStatus(422);
        $this->postJson("/api/staff/refunds/{$refund->id}/reject", ['reason' => 'Solicitud fuera de política'])
            ->assertOk()
            ->assertJsonPath('refund.status', 'refund_rejected')
            ->assertJsonPath('refund.rejection_reason', 'Solicitud fuera de política');

        $this->assertDatabaseHas('activity_logs', ['action' => 'refund_rejected', 'subject_id' => $refund->id]);
        Mail::assertNothingSent();
        Mail::assertNothingQueued();
        // Un reembolso rechazado no cuenta como reembolsado
        $this->assertEquals(0.0, $refund->booking->refundedAmount());
    }

    public function test_non_admin_cannot_manage_refunds(): void
    {
        $refund = $this->pendingRefund();

        Sanctum::actingAs($this->receptionist);
        $this->getJson('/api/staff/refunds')->assertStatus(403);
        $this->postJson("/api/staff/refunds/{$refund->id}/approve", ['method' => 'cash'])->assertStatus(403);

        Sanctum::actingAs($this->client);
        $this->postJson("/api/staff/refunds/{$refund->id}/reject", ['reason' => 'x x x'])->assertStatus(403);

        $this->assertDatabaseHas('payments', ['id' => $refund->id, 'status' => 'refund_pending']);
    }

    public function test_positive_payment_is_not_a_refund(): void
    {
        $booking = $this->makeBooking();
        $payment = $booking->payments()->first();
        Sanctum::actingAs($this->admin);

        $this->postJson("/api/staff/refunds/{$payment->id}/approve", ['method' => 'cash'])->assertStatus(404);
    }
}
