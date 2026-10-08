<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestión de Productos - Administrador</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f4f4f4; }
        h1 { color: #333; }
        .container { max-width: 1200px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #007bff; color: white; }
        tr:nth-child(even) { background: #f8f8f8; }
        .btn { padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; }
        .btn-primary { background: #007bff; color: white; }
        .btn-success { background: #28a745; color: white; }
        .btn-warning { background: #ffc107; color: #333; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-sm { padding: 4px 8px; font-size: 12px; }
        .btn-group { display: flex; flex-wrap: wrap; gap: 5px; }
        .alert { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .alert-danger { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .form-section { margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        .action-links { display: flex; gap: 10px; flex-wrap: wrap; }
        .badge { padding: 5px 10px; border-radius: 4px; font-size: 12px; }
        .badge-success { background: #d4edda; color: #155724; }
        .badge-danger { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛒 Catálogo de Productos y Servicios Extra</h1>

        @if(session('success'))
            <div class="alert alert-success">{{ session('success') }}</div>
        @endif

        @if($errors->any())
            <div class="alert alert-danger">
                <ul>
                    @foreach($errors->all() as $error)
                        <li>{{ $error }}</li>
                    @endforeach
                </ul>
            </div>
        @endif

        <div class="action-links">
            <a href="{{ route('products.create') }}" class="btn btn-primary">+ Nuevo Producto</a>
        </div>

        <div class="form-section">
            <h2>Filtros</h2>
            <form method="GET" action="{{ route('products.index') }}">
                <div class="form-group">
                    <label for="category">Categoría:</label>
                    <select name="category" id="category" onchange="this.form.submit()">
                        <option value="">Todas las categorías</option>
                        <option value="snacks" {{ request('category') == 'snacks' ? 'selected' : '' }}>Snacks</option>
                        <option value="bebidas" {{ request('category') == 'bebidas' ? 'selected' : '' }}>Bebidas</option>
                        <option value="servicios_spa" {{ request('category') == 'servicios_spa' ? 'selected' : '' }}>Servicios de Spa</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="search">Buscar por nombre:</label>
                    <input type="text" name="search" id="search" value="{{ request('search') }}" placeholder="Nombre del producto...">
                </div>
                <div class="form-group">
                    <label for="is_active">Estado:</label>
                    <select name="is_active" id="is_active" onchange="this.form.submit()">
                        <option value="">Todos</option>
                        <option value="1" {{ request('is_active') == '1' ? 'selected' : '' }}>Activos</option>
                        <option value="0" {{ request('is_active') == '0' ? 'selected' : '' }}>Inactivos</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-sm btn-outline-primary">Filtrar</button>
                <a href="{{ route('products.index') }}" class="btn btn-sm btn-outline-secondary">Limpiar</a>
            </form>
        </div>

        <h2>Lista de Productos</h2>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Stock</th>

                @empty
                <tr>
                    <td colspan="7">No hay productos registrados. <a href="{{ route('products.create') }}">Crear el primero</a></td>
                </tr>
                @endforelse
            </tbody>
        </table>

        <p><em>Total de productos: {{ $products->count() }}</em></p>
    </div>
</body>
</html>

