<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomImage;
use App\Models\RoomType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * SHE-035: imágenes múltiples por habitación y comodidades reales en el detalle público.
 */
class RoomImageTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        foreach (['admin', 'recepcionista', 'cliente'] as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }

        $this->room = Room::create([
            'room_number' => '701', 'name' => 'Suite Galería', 'bed_type' => 'king',
            'capacity' => 2, 'price_per_night' => 300, 'status' => 'disponible',
        ]);
    }

    private function actingAsRole(string $role): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);
        Sanctum::actingAs($user);
    }

    private function upload(int $count = 2)
    {
        $files = [];
        for ($i = 0; $i < $count; $i++) {
            $files[] = UploadedFile::fake()->image("foto{$i}.jpg", 800, 600)->size(200);
        }

        return $this->post("/api/staff/rooms/{$this->room->id}/images", ['images' => $files], ['Accept' => 'application/json']);
    }

    public function test_admin_uploads_images_first_becomes_primary_and_syncs_image_url(): void
    {
        $this->actingAsRole('admin');

        $res = $this->upload(2)->assertCreated()->assertJsonCount(2, 'images');

        $images = RoomImage::where('room_id', $this->room->id)->orderBy('sort_order')->get();
        $this->assertCount(2, $images);
        $this->assertTrue($images[0]->is_primary);
        $this->assertFalse($images[1]->is_primary);
        foreach ($images as $image) {
            Storage::disk('public')->assertExists($image->path);
            $this->assertStringNotContainsString('foto', $image->path); // nombre aleatorio
        }
        $this->assertSame('/storage/' . $images[0]->path, $this->room->fresh()->image_url);
        $this->assertSame('/storage/' . $images[0]->path, $res->json('images.0.url'));
    }

    public function test_upload_rejects_invalid_type_and_oversize(): void
    {
        $this->actingAsRole('admin');

        $this->post("/api/staff/rooms/{$this->room->id}/images", [
            'images' => [UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertStatus(422);

        $this->post("/api/staff/rooms/{$this->room->id}/images", [
            'images' => [UploadedFile::fake()->image('big.jpg')->size(5000)],
        ], ['Accept' => 'application/json'])->assertStatus(422);

        $this->assertSame(0, RoomImage::count());
    }

    public function test_reorder_and_set_primary(): void
    {
        $this->actingAsRole('admin');
        $this->upload(3);
        $ids = RoomImage::orderBy('sort_order')->pluck('id')->all();

        $reversed = array_reverse($ids);
        $this->patchJson("/api/staff/rooms/{$this->room->id}/images/reorder", ['order' => $reversed])
            ->assertOk();
        $this->assertSame($reversed, RoomImage::orderBy('sort_order')->pluck('id')->all());

        // Orden incompleto => 422
        $this->patchJson("/api/staff/rooms/{$this->room->id}/images/reorder", ['order' => [$ids[0]]])
            ->assertStatus(422);

        $this->patchJson("/api/staff/rooms/{$this->room->id}/images/{$ids[2]}/primary")
            ->assertOk()
            ->assertJsonPath('images.0.id', $ids[2])
            ->assertJsonPath('images.0.is_primary', true);
        $this->assertSame(1, RoomImage::where('is_primary', true)->count());
        $this->assertSame('/storage/' . RoomImage::find($ids[2])->path, $this->room->fresh()->image_url);
    }

    public function test_delete_image_promotes_next_and_clears_image_url_when_empty(): void
    {
        $this->actingAsRole('admin');
        $this->upload(2);
        [$first, $second] = RoomImage::orderBy('sort_order')->get()->all();

        $this->deleteJson("/api/staff/rooms/{$this->room->id}/images/{$first->id}")->assertOk();
        Storage::disk('public')->assertMissing($first->path);
        $this->assertTrue($second->fresh()->is_primary);
        $this->assertSame('/storage/' . $second->path, $this->room->fresh()->image_url);

        $this->deleteJson("/api/staff/rooms/{$this->room->id}/images/{$second->id}")->assertOk();
        $this->assertNull($this->room->fresh()->image_url);

        // Imagen de otra habitación => 404
        $other = Room::create(['room_number' => '702', 'name' => 'Otra', 'bed_type' => 'doble', 'capacity' => 2, 'price_per_night' => 100, 'status' => 'disponible']);
        $foreign = RoomImage::create(['room_id' => $other->id, 'path' => 'rooms/x.jpg', 'sort_order' => 1]);
        $this->deleteJson("/api/staff/rooms/{$this->room->id}/images/{$foreign->id}")->assertNotFound();
    }

    public function test_image_endpoints_require_admin(): void
    {
        $this->actingAsRole('recepcionista');
        $this->getJson("/api/staff/rooms/{$this->room->id}/images")->assertOk();
        $this->upload(1)->assertForbidden();
        $this->patchJson("/api/staff/rooms/{$this->room->id}/images/reorder", ['order' => [1]])->assertForbidden();
        $this->deleteJson("/api/staff/rooms/{$this->room->id}/images/1")->assertForbidden();
    }

    public function test_public_detail_returns_type_amenities_extras_and_images(): void
    {
        $type = RoomType::create([
            'name' => 'Suite', 'slug' => 'suite', 'base_price' => 450, 'capacity' => 2,
            'amenities' => ['wifi', 'minibar'], 'active' => true,
        ]);
        $this->room->update(['room_type_id' => $type->id, 'price_per_night' => null, 'extra_amenities' => ['balcony', 'wifi']]);
        RoomImage::create(['room_id' => $this->room->id, 'path' => 'rooms/b.jpg', 'sort_order' => 2, 'is_primary' => true]);
        RoomImage::create(['room_id' => $this->room->id, 'path' => 'rooms/a.jpg', 'sort_order' => 1, 'is_primary' => false]);

        $res = $this->getJson("/api/rooms/{$this->room->id}")->assertOk()
            ->assertJsonPath('room.price_per_night', 450)
            ->assertJsonPath('room.type_label', 'Suite')
            ->assertJsonPath('room.room_type.slug', 'suite');

        $this->assertSame(['wifi', 'minibar', 'balcony'], array_column($res->json('room.amenities'), 'key'));
        $this->assertSame('Balcón / terraza', $res->json('room.amenities.2.label'));
        $this->assertCount(2, $res->json('room.images'));
        $this->assertStringEndsWith('/storage/rooms/b.jpg', $res->json('room.images.0.url'));
        $this->assertStringStartsWith('http', $res->json('room.images.0.url'));
    }

    public function test_deleting_room_removes_gallery_files(): void
    {
        $this->actingAsRole('admin');
        $this->upload(1);
        $path = RoomImage::first()->path;

        $this->deleteJson("/api/staff/rooms/{$this->room->id}")->assertOk();
        Storage::disk('public')->assertMissing($path);
        $this->assertSame(0, RoomImage::count());
    }
}
