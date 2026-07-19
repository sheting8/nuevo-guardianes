import 'api_client.dart';

/// The five question types a `ChecklistTemplateItem` can have. Determines
/// both the shape of `configuracion` and the shape `respuesta` must take
/// when submitting an execution (validated server-side against the live
/// item — see `checklists.service.ts`'s `validarRespuesta()`).
enum TipoPreguntaChecklist {
  pasaFalla,
  numero,
  selector,
  matriz,
  texto;

  static TipoPreguntaChecklist fromJson(String? value) {
    switch (value) {
      case 'NUMERO':
        return TipoPreguntaChecklist.numero;
      case 'SELECTOR':
        return TipoPreguntaChecklist.selector;
      case 'MATRIZ':
        return TipoPreguntaChecklist.matriz;
      case 'TEXTO':
        return TipoPreguntaChecklist.texto;
      case 'PASA_FALLA':
      default:
        return TipoPreguntaChecklist.pasaFalla;
    }
  }
}

class ChecklistTemplateItem {
  ChecklistTemplateItem({
    required this.id,
    required this.orden,
    required this.descripcion,
    this.tipoPregunta = TipoPreguntaChecklist.pasaFalla,
    this.configuracion,
  });

  factory ChecklistTemplateItem.fromJson(Map<String, dynamic> json) => ChecklistTemplateItem(
        id: json['id'] as String,
        orden: json['orden'] as int,
        descripcion: json['descripcion'] as String,
        tipoPregunta: TipoPreguntaChecklist.fromJson(json['tipoPregunta'] as String?),
        configuracion: json['configuracion'] as Map<String, dynamic>?,
      );

  final String id;
  final int orden;
  final String descripcion;
  final TipoPreguntaChecklist tipoPregunta;

  /// Shape depends on [tipoPregunta] — NUMERO: `{ min?, max? }`, SELECTOR:
  /// `{ opciones: string[], multiple: bool }`, MATRIZ:
  /// `{ filas: string[], columnas: string[] }`. Left loosely typed rather
  /// than modeled with a class hierarchy since callers just pull out the
  /// couple of fields relevant to their own tipoPregunta branch.
  final Map<String, dynamic>? configuracion;
}

class ChecklistTemplate {
  ChecklistTemplate({
    required this.id,
    required this.nombre,
    this.descripcion,
    required this.alcanceTipo,
    required this.alcanceId,
    required this.tipoFrecuencia,
    this.intervaloMinutos,
    required this.activo,
    required this.items,
  });

  factory ChecklistTemplate.fromJson(Map<String, dynamic> json) => ChecklistTemplate(
        id: json['id'] as String,
        nombre: json['nombre'] as String,
        descripcion: json['descripcion'] as String?,
        alcanceTipo: json['alcanceTipo'] as String,
        alcanceId: json['alcanceId'] as String,
        tipoFrecuencia: json['tipoFrecuencia'] as String,
        intervaloMinutos: json['intervaloMinutos'] as int?,
        activo: json['activo'] as bool,
        items: (json['items'] as List<dynamic>? ?? [])
            .map((item) => ChecklistTemplateItem.fromJson(item as Map<String, dynamic>))
            .toList(),
      );

  final String id;
  final String nombre;
  final String? descripcion;
  final String alcanceTipo;
  final String alcanceId;
  final String tipoFrecuencia;
  final int? intervaloMinutos;
  final bool activo;
  final List<ChecklistTemplateItem> items;
}

/// One answered item in a checklist execution submission.
///
/// [respuesta]'s runtime shape depends on the item's tipoPregunta and must
/// match exactly what the API expects (validated server-side against the
/// LIVE item, not whatever configuracion the client happened to render
/// against):
/// - PASA_FALLA: a [bool]
/// - NUMERO: a [num]
/// - SELECTOR (single): a [String] from `opciones`
/// - SELECTOR (multiple): a `List<String>` subset of `opciones`
/// - MATRIZ: a `List<Map<String, String>>` of `{ "fila", "columna" }` pairs,
///   one per row — deliberately an array-of-objects rather than a single
///   object keyed by fila, since Postgres jsonb doesn't preserve key order
///   in a Record/object and the API relies on this shape.
/// - TEXTO: a non-empty [String]
class EjecucionItemInput {
  EjecucionItemInput({
    required this.checklistTemplateItemId,
    required this.respuesta,
    this.observacion,
  });

  final String checklistTemplateItemId;
  final Object respuesta;
  final String? observacion;

  Map<String, dynamic> toJson() => {
        'checklistTemplateItemId': checklistTemplateItemId,
        'respuesta': respuesta,
        if (observacion != null && observacion!.isNotEmpty) 'observacion': observacion,
      };
}

/// Wraps GET /checklists/templates?vencidos=true (the "pendientes" list) and
/// POST /checklists/templates/:id/ejecuciones (submitting a completed run).
/// Template authoring/editing stays a desk/admin task on web — not here.
class ChecklistRepository {
  ChecklistRepository({ApiClient? apiClient}) : _api = apiClient ?? ApiClient();

  final ApiClient _api;

  Future<List<ChecklistTemplate>> listarPendientes({int page = 1, int limit = 100}) async {
    final data = await _api.get(
      '/checklists/templates?vencidos=true&page=$page&limit=$limit',
    ) as List<dynamic>;
    return data
        .map((json) => ChecklistTemplate.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<void> ejecutar(
    String templateId, {
    String? observacionesGenerales,
    required List<EjecucionItemInput> items,
  }) async {
    await _api.post('/checklists/templates/$templateId/ejecuciones', body: {
      if (observacionesGenerales != null && observacionesGenerales.isNotEmpty)
        'observacionesGenerales': observacionesGenerales,
      'items': items.map((item) => item.toJson()).toList(),
    });
  }
}
