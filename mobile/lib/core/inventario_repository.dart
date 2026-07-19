import 'api_client.dart';

class Categoria {
  Categoria({
    required this.id,
    required this.nombre,
    this.descripcion,
    required this.activo,
  });

  factory Categoria.fromJson(Map<String, dynamic> json) => Categoria(
        id: json['id'] as String,
        nombre: json['nombre'] as String,
        descripcion: json['descripcion'] as String?,
        activo: json['activo'] as bool,
      );

  final String id;
  final String nombre;
  final String? descripcion;
  final bool activo;
}

class Ubicacion {
  Ubicacion({
    required this.id,
    required this.nombre,
    this.descripcion,
    required this.activo,
    this.carroId,
  });

  factory Ubicacion.fromJson(Map<String, dynamic> json) => Ubicacion(
        id: json['id'] as String,
        nombre: json['nombre'] as String,
        descripcion: json['descripcion'] as String?,
        activo: json['activo'] as bool,
        carroId: json['carroId'] as String?,
      );

  final String id;
  final String nombre;
  final String? descripcion;
  final bool activo;
  final String? carroId;
}

class ItemInventario {
  ItemInventario({
    required this.id,
    required this.nombre,
    this.descripcion,
    required this.categoriaId,
    required this.ubicacionId,
    this.codigo,
    required this.estado,
    required this.cantidad,
  });

  factory ItemInventario.fromJson(Map<String, dynamic> json) => ItemInventario(
        id: json['id'] as String,
        nombre: json['nombre'] as String,
        descripcion: json['descripcion'] as String?,
        categoriaId: json['categoriaId'] as String,
        ubicacionId: json['ubicacionId'] as String,
        codigo: json['codigo'] as String?,
        estado: json['estado'] as String,
        cantidad: json['cantidad'] as int,
      );

  final String id;
  final String nombre;
  final String? descripcion;
  final String categoriaId;
  final String ubicacionId;
  final String? codigo;
  final String estado;
  final int cantidad;
}

/// Wraps GET /inventario/items|categorias|ubicaciones. Mobile is read-only —
/// no create/edit/delete here, that stays a desk/admin task on web.
class InventarioRepository {
  InventarioRepository({ApiClient? apiClient}) : _api = apiClient ?? ApiClient();

  final ApiClient _api;

  Future<List<ItemInventario>> listarItems({
    int page = 1,
    int limit = 200,
    String? categoriaId,
    String? ubicacionId,
    String? estado,
    String? search,
  }) async {
    final params = <String, String>{'page': '$page', 'limit': '$limit'};
    if (categoriaId != null) params['categoriaId'] = categoriaId;
    if (ubicacionId != null) params['ubicacionId'] = ubicacionId;
    if (estado != null) params['estado'] = estado;
    if (search != null && search.isNotEmpty) params['search'] = search;
    final query = Uri(queryParameters: params).query;
    final data = await _api.get('/inventario/items?$query') as List<dynamic>;
    return data
        .map((json) => ItemInventario.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<List<Categoria>> listarCategorias() async {
    final data = await _api.get('/inventario/categorias') as List<dynamic>;
    return data.map((json) => Categoria.fromJson(json as Map<String, dynamic>)).toList();
  }

  Future<List<Ubicacion>> listarUbicaciones() async {
    final data = await _api.get('/inventario/ubicaciones') as List<dynamic>;
    return data.map((json) => Ubicacion.fromJson(json as Map<String, dynamic>)).toList();
  }
}
