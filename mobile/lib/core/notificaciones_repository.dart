import 'api_client.dart';

class Notificacion {
  Notificacion({
    required this.id,
    required this.tipo,
    required this.titulo,
    required this.cuerpo,
    this.datos,
    required this.leida,
    required this.createdAt,
  });

  factory Notificacion.fromJson(Map<String, dynamic> json) => Notificacion(
        id: json['id'] as String,
        tipo: json['tipo'] as String,
        titulo: json['titulo'] as String,
        cuerpo: json['cuerpo'] as String,
        datos: json['datos'] as Map<String, dynamic>?,
        leida: json['leida'] as bool,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  final String id;
  final String tipo;
  final String titulo;
  final String cuerpo;
  final Map<String, dynamic>? datos;
  final bool leida;
  final DateTime createdAt;
}

/// Wraps GET/PATCH /notificaciones and POST/DELETE /notificaciones/dispositivos
/// (see api/src/notificaciones/notificaciones.controller.ts, the source of
/// truth for this contract). Mobile only reads/marks-as-read and registers
/// its own device — no authoring here.
class NotificacionesRepository {
  NotificacionesRepository({ApiClient? apiClient}) : _api = apiClient ?? ApiClient();

  final ApiClient _api;

  Future<List<Notificacion>> listar({int page = 1, int limit = 20, bool? leida}) async {
    final params = <String, String>{'page': '$page', 'limit': '$limit'};
    if (leida != null) params['leida'] = '$leida';
    final query = Uri(queryParameters: params).query;
    final data = await _api.get('/notificaciones?$query') as List<dynamic>;
    return data
        .map((json) => Notificacion.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<void> marcarLeida(String id) => _api.patch('/notificaciones/$id/leer');

  Future<void> marcarTodasLeidas() => _api.patch('/notificaciones/leer-todas');

  Future<void> registrarDispositivo(String token, String plataforma) => _api.post(
        '/notificaciones/dispositivos',
        body: {'token': token, 'plataforma': plataforma},
      );

  Future<void> eliminarDispositivo(String token) =>
      _api.delete('/notificaciones/dispositivos/$token');
}
