import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/inventario_repository.dart';

class _InventarioData {
  _InventarioData({required this.items, required this.ubicaciones});

  final List<ItemInventario> items;
  final List<Ubicacion> ubicaciones;
}

/// Read-only browse screen for inventory items, grouped by ubicación.
/// No create/edit/delete here — inventory management is a desk/admin task on
/// web only.
class InventarioScreen extends StatefulWidget {
  const InventarioScreen({super.key, required this.onLogout});

  final VoidCallback onLogout;

  @override
  State<InventarioScreen> createState() => _InventarioScreenState();
}

class _InventarioScreenState extends State<InventarioScreen> {
  final _repo = InventarioRepository();
  late Future<_InventarioData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_InventarioData> _load() async {
    final items = await _repo.listarItems();
    final ubicaciones = await _repo.listarUbicaciones();
    return _InventarioData(items: items, ubicaciones: ubicaciones);
  }

  void _refresh() {
    setState(() => _future = _load());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventario'),
        actions: [
          IconButton(
            onPressed: widget.onLogout,
            icon: const Icon(Icons.logout),
            tooltip: 'Cerrar sesión',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          _refresh();
          await _future;
        },
        child: FutureBuilder<_InventarioData>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 200),
                  Center(child: CircularProgressIndicator()),
                ],
              );
            }
            if (snapshot.hasError) {
              final error = snapshot.error;
              final message =
                  error is ApiException ? error.message : 'Error al cargar el inventario';
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [Padding(padding: const EdgeInsets.all(24), child: Text(message))],
              );
            }
            final data = snapshot.data!;
            if (data.items.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No hay items de inventario.'),
                  ),
                ],
              );
            }

            final nombrePorUbicacion = {for (final u in data.ubicaciones) u.id: u.nombre};
            final grupos = <String, List<ItemInventario>>{};
            for (final item in data.items) {
              grupos.putIfAbsent(item.ubicacionId, () => []).add(item);
            }
            final ubicacionIds = grupos.keys.toList()
              ..sort(
                (a, b) => (nombrePorUbicacion[a] ?? '').compareTo(nombrePorUbicacion[b] ?? ''),
              );

            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                for (final ubicacionId in ubicacionIds) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
                    child: Text(
                      nombrePorUbicacion[ubicacionId] ?? 'Sin ubicación',
                      style: Theme.of(
                        context,
                      ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ),
                  for (final item in grupos[ubicacionId]!)
                    ListTile(
                      title: Text(item.nombre),
                      subtitle: Text(
                        [
                          if (item.codigo != null && item.codigo!.isNotEmpty) item.codigo!,
                          'Cantidad: ${item.cantidad}',
                        ].join(' · '),
                      ),
                      trailing: _EstadoBadge(estado: item.estado),
                    ),
                  const Divider(),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _EstadoBadge extends StatelessWidget {
  const _EstadoBadge({required this.estado});

  final String estado;

  @override
  Widget build(BuildContext context) {
    final Color color;
    switch (estado) {
      case 'OPERATIVO':
        color = Colors.green;
      case 'EN_MANTENCION':
        color = Colors.orange;
      case 'FUERA_DE_SERVICIO':
        color = Colors.red;
      case 'PERDIDO':
        color = Colors.blueGrey;
      default:
        color = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color),
      ),
      child: Text(
        estado.replaceAll('_', ' '),
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}
