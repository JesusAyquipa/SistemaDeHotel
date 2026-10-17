<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Charge;
use App\Models\Invoice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvoiceTest extends TestCase
{
    use RefreshDatabase, BillingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpBilling();
    }

    private function boleta(array $overrides = []): array
    {
        return array_merge([
            'type'                => 'boleta',
            'customer_doc_type'   => 'DNI',
            'customer_doc_number' => '45678912',
            'customer_name'       => 'Carla Cliente',
        ], $overrides);
    }

    private function factura(array $overrides = []): array
    {
        return array_merge([
            'type'                => 'factura',
            'customer_doc_type'   => 'RUC',
            'customer_doc_number' => '20100070970',
            'customer_name'       => 'Empresa SAC',
            'customer_address'    => 'Av. Siempre Viva 123, Lima',
        ], $overrides);
    }

    public function test_receptionist_issues_boleta_with_lodging_and_charges_and_igv_breakdown(): void
    {
        $booking = $this->makeBooking(['status' => Booking::STATUS_CHECKED_OUT]);
        Charge::create(['booking_id' => $booking->id, 'date' => now()->toDateString(), 'concept' => 'Agua mineral', 'quantity' => 2, 'unit_price' => 9, 'total' => 18]);
        Sanctum::actingAs($this->receptionist);

        $res = $this->postJson("/api/staff/bookings/{$booking->id}/invoice", $this->boleta())
            ->assertStatus(201)
            ->assertJsonPath('series', 'B001')
            ->assertJsonPath('number', 1)
            ->assertJsonPath('full_number', 'B001-00000001')
            ->assertJsonPath('status', 'issued')
            ->assertJsonPath('booking_code', $booking->booking_code)
            ->assertJsonStructure(['hotel' => ['name', 'ruc', 'address']]);

        $data = $res->json();
        $this->assertCount(2, $data['items']);
        $this->assertEquals(418.00, (float) $data['total']);
        $this->assertEquals(354.24, (float) $data['subtotal']); // 418 / 1.18
        $this->assertEquals(63.76, (float) $data['igv']);
        $this->assertEquals((float) $data['total'], round((float) $data['subtotal'] + (float) $data['igv'], 2));
    }

    public function test_numbering_is_sequential_per_series(): void
    {
        Sanctum::actingAs($this->admin);

        $b1 = $this->makeBooking(['check_in' => now()->addDays(20)->toDateString(), 'check_out' => now()->addDays(21)->toDateString()]);
        $b2 = $this->makeBooking(['check_in' => now()->addDays(22)->toDateString(), 'check_out' => now()->addDays(23)->toDateString()]);
        $b3 = $this->makeBooking(['check_in' => now()->addDays(24)->toDateString(), 'check_out' => now()->addDays(25)->toDateString()]);

        $this->postJson("/api/staff/bookings/{$b1->id}/invoice", $this->boleta())->assertJsonPath('number', 1);
        $this->postJson("/api/staff/bookings/{$b2->id}/invoice", $this->factura())->assertJsonPath('full_number', 'F001-00000001');
        $this->postJson("/api/staff/bookings/{$b3->id}/invoice", $this->boleta())->assertJsonPath('full_number', 'B001-00000002');

        // Anular y reemitir consume un nuevo número (no reutiliza).
        $first = Invoice::where('booking_id', $b1->id)->first();
        $this->postJson("/api/staff/invoices/{$first->id}/void", ['reason' => 'Datos del cliente errados'])->assertOk();
        $this->postJson("/api/staff/bookings/{$b1->id}/invoice", $this->boleta())->assertJsonPath('number', 3);
    }

    public function test_factura_requires_valid_ruc(): void
    {
        $booking = $this->makeBooking();
        Sanctum::actingAs($this->receptionist);

        $this->postJson("/api/staff/bookings/{$booking->id}/invoice", $this->factura(['customer_doc_type' => 'DNI', 'customer_doc_number' => '45678912']))
            ->assertStatus(422)->assertJsonValidationErrors('customer_doc_type');

        $this->postJson("/api/staff/bookings/{$booking->id}/invoice", $this->factura(['customer_doc_number' => '20100070971']))
            ->assertStatus(422)->assertJsonValidationErrors('customer_doc_number');

        $this->postJson("/api/staff/bookings/{$booking->id}/invoice", $this->factura(['customer_doc_number' => '2010007097']))
            ->assertStatus(422);

        $this->postJson("/api/staff/bookings/{$booking->id}/invoice", $this->boleta(['customer_doc_number' => '1234']))
            ->assertStatus(422)->assertJsonValidationErrors('customer_doc_number');

        $this->assertDatabaseCount('invoices', 0);
    }

    public function test_only_one_active_invoice_per_booking(): void
    {
        $booking = $this->makeBooking();
        Sanctum::actingAs($this->receptionist);

        $this->postJson("/api/staff/bookings/{$booking->id}/invoice", $this->boleta())->assertStatus(201);
        $this->postJson("/api/staff/bookings/{$booking->id}/invoice", $this->factura())->assertStatus(409);
        $this->assertDatabaseCount('invoices', 1);
    }

    public function test_cannot_invoice_cancelled_booking(): void
    {
        $booking = $this->makeBooking(['status' => Booking::STATUS_CANCELLED]);
        Sanctum::actingAs($this->receptionist);

        $this->postJson("/api/staff/bookings/{$booking->id}/invoice", $this->boleta())->assertStatus(422);
        $this->postJson('/api/staff/bookings/999999/invoice', $this->boleta())->assertStatus(404);
    }

    public function test_void_is_admin_only_and_requires_reason(): void
    {
        $booking = $this->makeBooking();
        Sanctum::actingAs($this->receptionist);
        $id = $this->postJson("/api/staff/bookings/{$booking->id}/invoice", $this->boleta())->json('id');

        $this->postJson("/api/staff/invoices/{$id}/void", ['reason' => 'Error'])->assertStatus(403);

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/staff/invoices/{$id}/void", [])->assertStatus(422);
        $this->postJson("/api/staff/invoices/{$id}/void", ['reason' => 'Error en razón social'])
            ->assertOk()
            ->assertJsonPath('status', 'voided')
            ->assertJsonPath('voided_reason', 'Error en razón social');
        $this->postJson("/api/staff/invoices/{$id}/void", ['reason' => 'Otra vez'])->assertStatus(422);

        $this->assertDatabaseHas('activity_logs', ['action' => 'invoice_voided', 'subject_type' => 'Invoice', 'subject_id' => $id]);
    }

    public function test_list_with_filters_and_roles(): void
    {
        $b1 = $this->makeBooking();
        $b2 = $this->makeBooking(['check_in' => now()->addDays(30)->toDateString(), 'check_out' => now()->addDays(31)->toDateString()]);
        Sanctum::actingAs($this->admin);
        $this->postJson("/api/staff/bookings/{$b1->id}/invoice", $this->boleta())->assertStatus(201);
        $this->postJson("/api/staff/bookings/{$b2->id}/invoice", $this->factura())->assertStatus(201);

        $this->getJson('/api/staff/invoices')->assertOk()->assertJsonPath('total', 2);
        $this->getJson('/api/staff/invoices?type=factura')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.series', 'F001');
        $this->getJson('/api/staff/invoices?search=B001-1')->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/staff/invoices?search=' . $b2->booking_code)->assertOk()->assertJsonPath('total', 1);

        Sanctum::actingAs($this->receptionist);
        $this->getJson('/api/staff/invoices')->assertOk();

        Sanctum::actingAs($this->client);
        $this->getJson('/api/staff/invoices')->assertStatus(403);
        $this->postJson("/api/staff/bookings/{$b1->id}/invoice", $this->boleta())->assertStatus(403);
    }

    public function test_owner_can_fetch_booking_invoice_others_get_404(): void
    {
        $booking = $this->makeBooking(['status' => Booking::STATUS_CHECKED_OUT]);

        Sanctum::actingAs($this->client);
        $this->getJson("/api/bookings/{$booking->booking_code}/invoice")->assertStatus(404);

        Sanctum::actingAs($this->receptionist);
        $this->postJson("/api/staff/bookings/{$booking->id}/invoice", $this->boleta())->assertStatus(201);
        $this->getJson("/api/bookings/{$booking->booking_code}/invoice")->assertOk();

        Sanctum::actingAs($this->client);
        $this->getJson("/api/bookings/{$booking->booking_code}/invoice")
            ->assertOk()
            ->assertJsonPath('full_number', 'B001-00000001');

        Sanctum::actingAs($this->otherClient);
        $this->getJson("/api/bookings/{$booking->booking_code}/invoice")->assertStatus(404);
    }

    public function test_guest_cannot_fetch_invoice_unauthenticated(): void
    {
        $booking = $this->makeBooking();
        $this->getJson("/api/bookings/{$booking->booking_code}/invoice")->assertStatus(401);
    }
}
