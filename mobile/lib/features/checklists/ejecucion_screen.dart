import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/checklist_repository.dart';

/// Renders the tapped template's items as a form. Each item gets an input
/// widget chosen by its `tipoPregunta` (pass/fail toggle, number field,
/// single/multi selector, matrix, or free text) + optional observación,
/// plus a top-level observaciones generales field. Submits via
/// POST /checklists/templates/:id/ejecuciones and pops back to the
/// pendientes list on success.
class ChecklistEjecucionScreen extends StatefulWidget {
  const ChecklistEjecucionScreen({super.key, required this.template});

  final ChecklistTemplate template;

  @override
  State<ChecklistEjecucionScreen> createState() => _ChecklistEjecucionScreenState();
}

class _ChecklistEjecucionScreenState extends State<ChecklistEjecucionScreen> {
  final _repo = ChecklistRepository();
  final _observacionesGeneralesController = TextEditingController();

  late final List<ChecklistTemplateItem> _items;
  late final Map<String, TextEditingController> _observacionControllers;

  // Per-tipoPregunta answer state, keyed by item id.
  final Map<String, bool> _pasaFalla = {};
  final Map<String, TextEditingController> _numeroControllers = {};
  final Map<String, String?> _selectorUnico = {};
  final Map<String, Set<String>> _selectorMultiple = {};
  final Map<String, Map<String, String>> _matriz = {};

  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _items = [...widget.template.items]..sort((a, b) => a.orden.compareTo(b.orden));
    _observacionControllers = {for (final item in _items) item.id: TextEditingController()};

    for (final item in _items) {
      switch (item.tipoPregunta) {
        case TipoPreguntaChecklist.pasaFalla:
          _pasaFalla[item.id] = true;
          break;
        case TipoPreguntaChecklist.numero:
          _numeroControllers[item.id] = TextEditingController();
          break;
        case TipoPreguntaChecklist.selector:
          final multiple = item.configuracion?['multiple'] == true;
          if (multiple) {
            _selectorMultiple[item.id] = <String>{};
          } else {
            _selectorUnico[item.id] = null;
          }
          break;
        case TipoPreguntaChecklist.matriz:
          _matriz[item.id] = {};
          break;
        case TipoPreguntaChecklist.texto:
          break;
      }
    }
  }

  @override
  void dispose() {
    _observacionesGeneralesController.dispose();
    for (final controller in _observacionControllers.values) {
      controller.dispose();
    }
    for (final controller in _numeroControllers.values) {
      controller.dispose();
    }
    for (final controller in _textoControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  List<String> _opciones(ChecklistTemplateItem item) =>
      (item.configuracion?['opciones'] as List<dynamic>? ?? []).cast<String>();

  List<String> _filas(ChecklistTemplateItem item) =>
      (item.configuracion?['filas'] as List<dynamic>? ?? []).cast<String>();

  List<String> _columnas(ChecklistTemplateItem item) =>
      (item.configuracion?['columnas'] as List<dynamic>? ?? []).cast<String>();

  /// Builds the `respuesta` value for one item, matching the shape the API
  /// expects for its tipoPregunta. Returns null if the item hasn't been
  /// answered yet (e.g. an unselected radio/matrix row, or an unparsable
  /// number) — submission is blocked until every item has a value.
  Object? _respuestaFor(ChecklistTemplateItem item) {
    switch (item.tipoPregunta) {
      case TipoPreguntaChecklist.pasaFalla:
        return _pasaFalla[item.id] ?? true;
      case TipoPreguntaChecklist.numero:
        final text = _numeroControllers[item.id]!.text.trim();
        return num.tryParse(text);
      case TipoPreguntaChecklist.selector:
        final multiple = item.configuracion?['multiple'] == true;
        if (multiple) {
          final selected = _selectorMultiple[item.id] ?? <String>{};
          return selected.isEmpty ? null : selected.toList();
        }
        return _selectorUnico[item.id];
      case TipoPreguntaChecklist.matriz:
        final filas = _filas(item);
        final respuestas = _matriz[item.id] ?? {};
        if (filas.any((fila) => !respuestas.containsKey(fila))) {
          return null;
        }
        return [
          for (final fila in filas) {'fila': fila, 'columna': respuestas[fila]!},
        ];
      case TipoPreguntaChecklist.texto:
        final text = _observacionTextoController(item.id).text.trim();
        return text.isEmpty ? null : text;
    }
  }

  // TEXTO items reuse a dedicated controller map keyed by item id (separate
  // from the per-item observación controller).
  final Map<String, TextEditingController> _textoControllers = {};

  TextEditingController _observacionTextoController(String itemId) =>
      _textoControllers.putIfAbsent(itemId, () => TextEditingController());

  Future<void> _submit() async {
    final items = <EjecucionItemInput>[];
    for (final item in _items) {
      final respuesta = _respuestaFor(item);
      if (respuesta == null) {
        setState(() => _error = 'Completá la respuesta de "${item.descripcion}"');
        return;
      }
      items.add(
        EjecucionItemInput(
          checklistTemplateItemId: item.id,
          respuesta: respuesta,
          observacion: _observacionControllers[item.id]!.text.trim(),
        ),
      );
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await _repo.ejecutar(
        widget.template.id,
        observacionesGenerales: _observacionesGeneralesController.text.trim(),
        items: items,
      );

      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Widget _buildRespuestaInput(ChecklistTemplateItem item) {
    switch (item.tipoPregunta) {
      case TipoPreguntaChecklist.pasaFalla:
        return SegmentedButton<bool>(
          segments: const [
            ButtonSegment(value: true, label: Text('Cumple'), icon: Icon(Icons.check)),
            ButtonSegment(value: false, label: Text('No cumple'), icon: Icon(Icons.close)),
          ],
          selected: {_pasaFalla[item.id] ?? true},
          onSelectionChanged: (selection) =>
              setState(() => _pasaFalla[item.id] = selection.first),
        );

      case TipoPreguntaChecklist.numero:
        final controller = _numeroControllers[item.id]!;
        final min = (item.configuracion?['min'] as num?)?.toDouble();
        final max = (item.configuracion?['max'] as num?)?.toDouble();
        final value = num.tryParse(controller.text.trim());
        final fueraDeRango =
            value != null && ((min != null && value < min) || (max != null && value > max));
        final rangoLabel = min != null || max != null
            ? ' (rango: ${min ?? '-∞'} a ${max ?? '∞'})'
            : '';
        return TextFormField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            labelText: 'Valor$rangoLabel',
            helperText: fueraDeRango ? 'Fuera del rango esperado' : null,
            helperStyle: fueraDeRango
                ? TextStyle(color: Theme.of(context).colorScheme.error)
                : null,
          ),
        );

      case TipoPreguntaChecklist.selector:
        final opciones = _opciones(item);
        final multiple = item.configuracion?['multiple'] == true;
        if (multiple) {
          final selected = _selectorMultiple[item.id] ?? <String>{};
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final opcion in opciones)
                CheckboxListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(opcion),
                  value: selected.contains(opcion),
                  onChanged: (checked) => setState(() {
                    final set = _selectorMultiple.putIfAbsent(item.id, () => <String>{});
                    if (checked == true) {
                      set.add(opcion);
                    } else {
                      set.remove(opcion);
                    }
                  }),
                ),
            ],
          );
        }
        final seleccion = _selectorUnico[item.id];
        return RadioGroup<String>(
          groupValue: seleccion,
          onChanged: (value) => setState(() => _selectorUnico[item.id] = value),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final opcion in opciones)
                RadioListTile<String>(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(opcion),
                  value: opcion,
                ),
            ],
          ),
        );

      case TipoPreguntaChecklist.matriz:
        final filas = _filas(item);
        final columnas = _columnas(item);
        final respuestas = _matriz.putIfAbsent(item.id, () => {});
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final fila in filas) ...[
              Text(fila, style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 4),
              SegmentedButton<String>(
                segments: [
                  for (final columna in columnas)
                    ButtonSegment(value: columna, label: Text(columna)),
                ],
                selected: respuestas[fila] == null ? {} : {respuestas[fila]!},
                emptySelectionAllowed: true,
                onSelectionChanged: (selection) => setState(() {
                  if (selection.isNotEmpty) {
                    respuestas[fila] = selection.first;
                  }
                }),
              ),
              const SizedBox(height: 8),
            ],
          ],
        );

      case TipoPreguntaChecklist.texto:
        return TextFormField(
          controller: _observacionTextoController(item.id),
          maxLines: 3,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(labelText: 'Respuesta'),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.template.nombre)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (widget.template.descripcion != null && widget.template.descripcion!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(widget.template.descripcion!),
            ),
          for (final item in _items)
            Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.descripcion, style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 8),
                    _buildRespuestaInput(item),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _observacionControllers[item.id],
                      decoration: const InputDecoration(labelText: 'Observación (opcional)'),
                    ),
                  ],
                ),
              ),
            ),
          TextField(
            controller: _observacionesGeneralesController,
            decoration: const InputDecoration(labelText: 'Observaciones generales (opcional)'),
            maxLines: 3,
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Enviar'),
          ),
        ],
      ),
    );
  }
}
