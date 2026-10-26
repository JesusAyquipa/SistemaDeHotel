<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * SHE-013: catálogo de productos y servicios extra.
 * Basado en el test de Jesús Ayquipa (commit 5bec1f7, rama `jesus`), adaptado a las rutas
 * actuales /api/staff/products y a los permisos por rol.
 */
class ProductCatalogTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $receptionist;
    private User $client;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['admin', 'recepcionista', 'cliente'] as $role) {
            Role::findOrCreate($role, 'web');
        }

        $this->admin = User::factory()->create(['is_active' => true]);
        $this->admin->assignRole('admin');
        $this->receptionist = User::factory()->create(['is_active' => true]);
        $this->receptionist->assignRole('recepcionista');
        $this->client = User::factory()->create(['is_active' => true]);
        $this->client->assignRole('cliente');
    }

    private function product(array $overrides = []): Product
    {
        return Product::create(array_merge([
            'name'      => 'Agua Mineral',
            'category'  => 'bebidas',
            'price'     => 5.00,
            'stock'     => 50,
            'is_active' => true,
        ], $overrides));
    }

    public function test_staff_can_list_products_with_filters(): void
    {
        $this->product();
        $this->product(['name' => 'Masaje Relajante', 'category' => 'servicios_spa', 'price' => 120]);
        $this->product(['name' => 'Chocolate', 'category' => 'snacks', 'is_active' => false]);

        Sanctum::actingAs($this->receptionist);

        $this->getJson('/api/staff/products')
            ->assertOk()
            ->assertJsonCount(3, 'products');

        $this->getJson('/api/staff/products?category=bebidas')
            ->assertOk()
            ->assertJsonCount(1, 'products')
            ->assertJsonPath('products.0.name', 'Agua Mineral');

        $this->getJson('/api/staff/products?search=masaje')
            ->assertOk()
            ->assertJsonCount(1, 'products');

        $this->getJson('/api/staff/products?is_active=1')
            ->assertOk()
            ->assertJsonCount(2, 'products');
    }

    public function test_admin_can_create_product_with_valid_category(): void
    {
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/staff/products', [
            'name'     => 'Papas Nativas',
            'category' => 'snacks',
            'price'    => 8.50,
            'stock'    => 20,
        ])->assertCreated()
          ->assertJsonPath('product.name', 'Papas Nativas');

        $this->assertDatabaseHas('products', ['name' => 'Papas Nativas', 'category' => 'snacks', 'stock' => 20]);
    }

    public function test_service_categories_do_not_track_stock_by_default(): void
    {
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/staff/products', [
            'name'     => 'Sauna',
            'category' => 'servicios_spa',
            'price'    => 50,
        ])->assertCreated();

        $this->assertFalse(Product::where('name', 'Sauna')->first()->tracks_stock);
    }

    public function test_create_rejects_invalid_category_and_missing_price(): void
    {
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/staff/products', ['name' => 'X', 'category' => 'licores'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['category', 'price']);
    }

    public function test_admin_can_update_price_and_stock(): void
    {
        $product = $this->product(['name' => 'Botella de Vino', 'price' => 85, 'stock' => 10]);
        Sanctum::actingAs($this->admin);

        $this->putJson("/api/staff/products/{$product->id}", ['price' => 120, 'stock' => 15])
            ->assertOk();

        $fresh = $product->fresh();
        $this->assertEquals(120, (float) $fresh->price);
        $this->assertSame(15, $fresh->stock);
    }

    public function test_admin_can_delete_product(): void
    {
        $product = $this->product();
        Sanctum::actingAs($this->admin);

        $this->deleteJson("/api/staff/products/{$product->id}")->assertOk();
        $this->assertDatabaseMissing('products', ['id' => $product->id]);
    }

    public function test_receptionist_can_read_but_not_modify_catalog(): void
    {
        $product = $this->product();
        Sanctum::actingAs($this->receptionist);

        $this->getJson("/api/staff/products/{$product->id}")->assertOk();
        $this->postJson('/api/staff/products', ['name' => 'Y', 'category' => 'snacks', 'price' => 1])->assertForbidden();
        $this->putJson("/api/staff/products/{$product->id}", ['price' => 1])->assertForbidden();
        $this->deleteJson("/api/staff/products/{$product->id}")->assertForbidden();
    }

    public function test_client_and_guest_cannot_access_catalog(): void
    {
        $this->getJson('/api/staff/products')->assertUnauthorized();

        Sanctum::actingAs($this->client);
        $this->getJson('/api/staff/products')->assertForbidden();
    }

    public function test_product_casts_stock_and_active_flag(): void
    {
        $product = $this->product(['stock' => '7', 'is_active' => 1])->fresh();

        $this->assertSame(7, $product->stock);
        $this->assertTrue($product->is_active);
    }
}
