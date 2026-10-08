<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nuevo Producto - Administrador</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f4f4f4; }
        h1 { color: #333; }
        .container { max-width: 800px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: bold; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
        .btn { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; font-size: 14px; }
        .btn-primary { background: #007bff; color: white; }
        .btn-danger { background: #dc3545; color: white; }
        .alert { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .alert-danger { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .btn-back { background: #6c757d; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <h1>➕ Nuevo Producto</h1>

        <h2>Detalles del Producto</h2>
        <form action="{{ route('products.store') }}" method="POST">
            @csrf

            <div class="form-group">
                <label for="name">Nombre del producto:</label>
                <input type="text" name="name" id="name" value="{{ old('name') }}" required>
            </div>

            <div class="form-group">
                <label for="category">Categoría:</label>
                <select name="category" id="category" required>
                    <option value="">Seleccione una categoría</option>
                    <option value="snacks" {{ old('category') == 'snacks' ? 'selected' : '' }}>Snacks</option>
                    <option value="bebidas" {{ old('category') == 'bebidas' ? 'selected' : '' }}>Bebidas</option>
                    <option value="servicios_spa" {{ old('category') == 'servicios_spa' ? 'selected' : '' }}>Servicios de Spa</option>
                </select>
            </div>

            <div class="form-group">
                <label for="price">Precio (S/):</label>
                <input type="number" name="price" id="price" value="{{ old('price') }}" step="0.01" min="0" required>
            </div>

            <div class="form-group">
                <label for="stock">Stock:</label>
                <input type="number" name="stock" id="stock" value="{{ old('stock') }}" min="0" required>
            </div>

            <div class="form-group">
                <label for="is_active">Estado:</label>
                <select name="is_active" id="is_active">
                    <option value="1" {{ old('is_active', true) == '1' ? 'selected' : '' }}>Activo</option>
                    <option value="0" {{ old('is_active', true) == '0' ? 'selected' : '' }}>Inactivo</option>
                </select>
            </div>

            <div class="form-group">
                <button type="submit" class="btn btn-primary">Guardar Producto</button>
                <a href="{{ route('products.index') }}" class="btn btn-danger">Cancelar</a>
            </div>
        </form>
    </div>
</body>
</html>
