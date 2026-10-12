<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Room;
use App\Models\Guest;
use App\Models\Booking;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ProductCatalogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        \Spatie\Permission\Models\Role::firstOrCreate(['name' => 'admin']);
        \Spatie\Permission\Models\Role::firstOrCreate(['name' => 'recepcionista']);
    }

    public function test_can_list_products()
    {
        Product::create([
            'name' => 'Agua Mineral',
            'category' => 'bebidas',
            'price' => 5.00,
            'stock' => 20,
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/products');

        $response->assertStatus(200)
                 ->assertJsonCount(1)
                 ->assertJsonFragment(['name' => 'Agua Mineral']);
    }

    public function test_can_create_product_with_valid_category()
    {
        $payload = [
            'name' => 'Papas Nativas',
            'category' => 'snacks',
            'price' => 8.50,
            'stock' => 15,
            'is_active' => true,
        ];

        $response = $this->postJson('/api/products', $payload);

        $response->assertStatus(201)
                 ->assertJsonFragment(['name' => 'Papas Nativas']);

        $this->assertDatabaseHas('products', [
            'name' => 'Papas Nativas',
            'stock' => 15,
        ]);
    }

    public function test_can_update_product_and_stock()
    {
        $product = Product::create([
            'name' => 'Masaje Relajante',
            'category' => 'servicios_spa',
            'price' => 100.00,
            'stock' => 999,
            'is_active' => true,
        ]);

        $response = $this->putJson("/api/products/{$product->id}", [
            'price' => 120.00,
            'stock' => 999,
        ]);

        $response->assertStatus(200)
                 ->assertJsonPath('product.price', '120.00');

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'price' => 120.00,
        ]);
    }

    public function test_stock_validation_fails_when_insufficient_stock()
    {
        $user = User::factory()->create();
        $user->assignRole('recepcionista');

        $room = Room::create([
            'room_number' => '101',
            'name' => 'Habitación Simple 101',
            'type' => 'individual',
            'bed_type' => '1 plaza',
            'price_per_night' => 100,
            'capacity' => 1,
            'status' => 'ocupada',
        ]);

        $guest = Guest::create([
            'name' => 'Juan',
            'surname' => 'Perez',
            'email' => 'juan@example.com',
            'phone' => '123456789',
            'document_type' => 'DNI',
            'document_number' => '12345678',
        ]);

        $booking = Booking::create([
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'check_in' => now()->toDateString(),
            'check_out' => now()->addDays(2)->toDateString(),
            'total_amount' => 200,
            'status' => 'confirmed',
        ]);

        $product = Product::create([
            'name' => 'Cerveza Artesanal',
            'category' => 'bebidas',
            'price' => 12.00,
            'stock' => 2, // solo 2 en stock
            'is_active' => true,
        ]);

        // Intentar cargar 5 cuando solo hay 2
        $response = $this->actingAs($user, 'sanctum')->postJson("/api/staff/bookings/{$booking->id}/charges", [
            'date' => now()->toDateString(),
            'product_id' => $product->id,
            'quantity' => 5,
        ]);

        $response->assertStatus(422)
                 ->assertJsonFragment([
                     'message' => 'Stock insuficiente para el producto seleccionado. Stock actual: 2'
                 ]);

        // Verificar que el stock no cambió
        $this->assertEquals(2, $product->fresh()->stock);
    }

    public function test_stock_validation_succeeds_and_decrements_stock()
    {
        $user = User::factory()->create();
        $user->assignRole('recepcionista');

        $room = Room::create([
            'room_number' => '102',
            'name' => 'Habitación Doble 102',
            'type' => 'doble',
            'bed_type' => '2 plazas',
            'price_per_night' => 150,
            'capacity' => 2,
            'status' => 'ocupada',
        ]);

        $guest = Guest::create([
            'name' => 'Maria',
            'surname' => 'Lopez',
            'email' => 'maria@example.com',
            'phone' => '987654321',
            'document_type' => 'DNI',
            'document_number' => '87654321',
        ]);

        $booking = Booking::create([
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'check_in' => now()->toDateString(),
            'check_out' => now()->addDays(3)->toDateString(),
            'total_amount' => 450,
            'status' => 'confirmed',
        ]);

        $product = Product::create([
            'name' => 'Vino Tinto',
            'category' => 'bebidas',
            'price' => 85.00,
            'stock' => 10,
            'is_active' => true,
        ]);

        // Consumir 3 vinos
        $response = $this->actingAs($user, 'sanctum')->postJson("/api/staff/bookings/{$booking->id}/charges", [
            'date' => now()->toDateString(),
            'product_id' => $product->id,
            'quantity' => 3,
        ]);

        $response->assertStatus(200)
                 ->assertJsonPath('charge.quantity', 3)
                 ->assertJsonPath('charge.unit_price', '85.00')
                 ->assertJsonPath('charge.total', 255);

        // Verificar que el stock se redujo de 10 a 7
        $this->assertEquals(7, $product->fresh()->stock);
    }
}
