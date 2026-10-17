<?php

namespace Tests\Feature;

use App\Events\BookingCheckedOut;
use App\Mail\ReviewRequestMail;
use App\Models\Booking;
use App\Models\Guest;
use App\Models\Payment;
use App\Models\Review;
use App\Models\Room;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * SHE-037: reseñas de huéspedes, moderación y solicitud tras el check-out.
 */
class ReviewTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;
    private User $owner;
    private User $other;
    private User $receptionist;
    private User $admin;
    private Guest $guest;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['admin', 'recepcionista', 'cliente'] as $role) {
            Role::create(['name' => $role, 'guard_name' => 'web']);
        }

        $this->owner = User::factory()->create(['email' => 'owner@example.com', 'is_active' => true]);
        $this->owner->assignRole('cliente');
        $this->other = User::factory()->create(['email' => 'other@example.com', 'is_active' => true]);
        $this->other->assignRole('cliente');
        $this->receptionist = User::factory()->create(['is_active' => true]);
        $this->receptionist->assignRole('recepcionista');
        $this->admin = User::factory()->create(['is_active' => true]);
        $this->admin->assignRole('admin');

        $this->room = Room::create([
            'room_number'     => '501',
            'name'            => 'King Reseñas',
            'bed_type'        => 'king',
            'capacity'        => 2,
            'price_per_night' => 400.00,
            'status'          => 'disponible',
        ]);

        $this->guest = Guest::create([
            'name'            => 'Ana María',
            'surname'         => 'Duena',
            'document_type'   => 'DNI',
            'document_number' => '12345678',
            'email'           => 'owner@example.com',
            'user_id'         => $this->owner->id,
        ]);
    }

    private function booking(string $status = Booking::STATUS_CHECKED_OUT, array $overrides = []): Booking
    {
        return Booking::create(array_merge([
            'guest_id'     => $this->guest->id,
            'room_id'      => $this->room->id,
            'check_in'     => now()->subDays(3)->toDateString(),
            'check_out'    => now()->subDay()->toDateString(),
            'total_amount' => 800.00,
            'status'       => $status,
        ], $overrides));
    }

    private function review(array $overrides = []): Review
    {
        $booking = $overrides['booking'] ?? $this->booking();
        unset($overrides['booking']);

        return Review::create(array_merge([
            'booking_id' => $booking->id,
            'room_id'    => $this->room->id,
            'guest_id'   => $this->guest->id,
            'rating'     => 5,
            'comment'    => 'Excelente estadía, muy recomendable.',
            'status'     => Review::STATUS_PENDING,
        ], $overrides));
    }

    private function assertMailSent(string $class, ?callable $cb = null): void
    {
        is_subclass_of($class, ShouldQueue::class)
            ? Mail::assertQueued($class, $cb)
            : Mail::assertSent($class, $cb);
    }

    // ---------------------------------------------------------- creación

    public function test_owner_can_review_checked_out_booking_once(): void
    {
        $booking = $this->booking();
        Sanctum::actingAs($this->owner);

        $this->postJson("/api/bookings/{$booking->booking_code}/review", ['rating' => 4, 'comment' => 'Muy buena atención y limpieza.'])
            ->assertStatus(201)
            ->assertJsonPath('review.status', 'pending');

        $this->assertDatabaseHas('reviews', ['booking_id' => $booking->id, 'room_id' => $this->room->id, 'rating' => 4]);

        $this->postJson("/api/bookings/{$booking->booking_code}/review", ['rating' => 5, 'comment' => 'Otra reseña más para probar.'])
            ->assertStatus(409);
        $this->assertDatabaseCount('reviews', 1);

        $this->getJson("/api/bookings/{$booking->booking_code}/review")->assertOk()->assertJsonPath('review.rating', 4);
    }

    public function test_review_requires_checked_out_status(): void
    {
        foreach ([Booking::STATUS_CONFIRMED, Booking::STATUS_CHECKED_IN, Booking::STATUS_CANCELLED] as $status) {
            $booking = $this->booking($status);
            Sanctum::actingAs($this->owner);
            $this->postJson("/api/bookings/{$booking->booking_code}/review", ['rating' => 5, 'comment' => 'Comentario suficientemente largo.'])
                ->assertStatus(422);
        }
        $this->assertDatabaseCount('reviews', 0);
    }

    public function test_review_is_owner_only(): void
    {
        $booking = $this->booking();
        $payload = ['rating' => 5, 'comment' => 'Comentario suficientemente largo.'];

        Sanctum::actingAs($this->other);
        $this->postJson("/api/bookings/{$booking->booking_code}/review", $payload)->assertNotFound();

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/bookings/{$booking->booking_code}/review", $payload)->assertNotFound();

        $this->assertDatabaseCount('reviews', 0);
    }

    public function test_review_validation_length_rating_and_profanity(): void
    {
        $booking = $this->booking();
        Sanctum::actingAs($this->owner);
        $url = "/api/bookings/{$booking->booking_code}/review";

        $this->postJson($url, ['rating' => 6, 'comment' => 'corto'])
            ->assertStatus(422)->assertJsonValidationErrors(['rating', 'comment']);
        $this->postJson($url, ['rating' => 3, 'comment' => str_repeat('a', 1001)])
            ->assertStatus(422)->assertJsonValidationErrors(['comment']);
        $this->postJson($url, ['rating' => 1, 'comment' => 'El servicio fue una mierda total.'])
            ->assertStatus(422)->assertJsonValidationErrors(['comment']);

        $this->assertDatabaseCount('reviews', 0);
    }

    // ------------------------------------------------------------ público

    public function test_public_endpoint_returns_only_published_reviews_with_summary(): void
    {
        $this->review(['status' => Review::STATUS_PUBLISHED, 'rating' => 5, 'published_at' => now()]);
        $this->review(['status' => Review::STATUS_PUBLISHED, 'rating' => 4, 'published_at' => now()]);
        $this->review(['status' => Review::STATUS_PENDING, 'rating' => 1]);
        $this->review(['status' => Review::STATUS_HIDDEN, 'rating' => 1]);

        $res = $this->getJson("/api/rooms/{$this->room->id}/reviews")->assertOk();
        $res->assertJsonCount(2, 'data')
            ->assertJsonPath('summary.count', 2)
            ->assertJsonPath('summary.average', 4.5)
            ->assertJsonPath('data.0.author', 'Ana D.');
        $this->assertArrayNotHasKey('guest', $res->json('data.0'));

        $this->getJson('/api/rooms/999999/reviews')->assertNotFound();
    }

    public function test_public_room_payloads_include_rating(): void
    {
        $this->review(['status' => Review::STATUS_PUBLISHED, 'rating' => 5, 'published_at' => now()]);
        $this->review(['status' => Review::STATUS_PUBLISHED, 'rating' => 2, 'published_at' => now()]);
        $this->review(['status' => Review::STATUS_HIDDEN, 'rating' => 1]);

        $rooms = collect($this->getJson('/api/rooms/available')->assertOk()->json())->keyBy('id');
        $this->assertEquals(3.5, $rooms[$this->room->id]['rating_avg']);
        $this->assertEquals(2, $rooms[$this->room->id]['reviews_count']);

        $this->getJson("/api/rooms/{$this->room->id}")
            ->assertOk()
            ->assertJsonPath('room.rating_avg', 3.5)
            ->assertJsonPath('room.reviews_count', 2);
    }

    // --------------------------------------------------------- moderación

    public function test_moderation_is_admin_only(): void
    {
        $review = $this->review();

        foreach ([$this->receptionist, $this->owner] as $user) {
            Sanctum::actingAs($user);
            $this->getJson('/api/staff/reviews')->assertForbidden();
            $this->postJson("/api/staff/reviews/{$review->id}/publish")->assertForbidden();
            $this->putJson("/api/staff/reviews/{$review->id}/reply", ['reply' => 'Gracias'])->assertForbidden();
        }

        $this->assertDatabaseHas('reviews', ['id' => $review->id, 'status' => 'pending', 'staff_reply' => null]);
    }

    public function test_admin_can_list_publish_hide_and_reply(): void
    {
        $review = $this->review(['rating' => 2]);
        $this->review(['rating' => 5, 'status' => Review::STATUS_PUBLISHED]);
        Sanctum::actingAs($this->admin);

        $this->getJson('/api/staff/reviews?status=pending')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('counts.pending', 1)
            ->assertJsonPath('counts.published', 1);
        $this->getJson('/api/staff/reviews?rating=5')->assertOk()->assertJsonCount(1, 'data');

        $this->postJson("/api/staff/reviews/{$review->id}/publish")->assertOk()->assertJsonPath('review.status', 'published');
        $this->assertNotNull($review->fresh()->published_at);

        $this->putJson("/api/staff/reviews/{$review->id}/reply", ['reply' => 'Gracias por tu visita, mejoraremos.'])
            ->assertOk()
            ->assertJsonPath('review.staff_reply', 'Gracias por tu visita, mejoraremos.');

        $this->getJson("/api/rooms/{$this->room->id}/reviews")
            ->assertOk()
            ->assertJsonPath('data.0.staff_reply', 'Gracias por tu visita, mejoraremos.');

        $this->postJson("/api/staff/reviews/{$review->id}/hide")->assertOk()->assertJsonPath('review.status', 'hidden');
        $this->postJson('/api/staff/reviews/999999/hide')->assertNotFound();
    }

    // ----------------------------------------------------------- check-out

    private function checkedInBookingReadyForCheckout(): Booking
    {
        $booking = $this->booking(Booking::STATUS_CHECKED_IN, [
            'check_in'  => now()->subDays(2)->toDateString(),
            'check_out' => now()->toDateString(),
        ]);
        Payment::create([
            'booking_id'     => $booking->id,
            'amount'         => 800.00,
            'payment_method' => 'card',
            'status'         => 'completed',
            'currency'       => 'PEN',
            'paid_at'        => now(),
        ]);

        return $booking;
    }

    public function test_checkout_dispatches_booking_checked_out_event(): void
    {
        Event::fake([BookingCheckedOut::class]);
        $booking = $this->checkedInBookingReadyForCheckout();

        Sanctum::actingAs($this->receptionist);
        $this->postJson("/api/staff/bookings/{$booking->booking_code}/check-out")->assertOk();

        Event::assertDispatched(BookingCheckedOut::class, fn ($e) => $e->booking->id === $booking->id);
    }

    public function test_checkout_sends_review_request_mail(): void
    {
        Mail::fake();
        $booking = $this->checkedInBookingReadyForCheckout();

        Sanctum::actingAs($this->receptionist);
        $this->postJson("/api/staff/bookings/{$booking->booking_code}/check-out")->assertOk();

        $this->assertMailSent(ReviewRequestMail::class, function (ReviewRequestMail $mail) use ($booking) {
            return $mail->hasTo('owner@example.com')
                && str_ends_with($mail->reviewUrl, '/cliente/mis-reservas/' . $booking->booking_code . '#resena');
        });
    }

    public function test_failed_checkout_does_not_dispatch_event(): void
    {
        Event::fake([BookingCheckedOut::class]);
        $booking = $this->booking(Booking::STATUS_CONFIRMED);

        Sanctum::actingAs($this->receptionist);
        $this->postJson("/api/staff/bookings/{$booking->booking_code}/check-out")->assertStatus(422);

        Event::assertNotDispatched(BookingCheckedOut::class);
    }
}
