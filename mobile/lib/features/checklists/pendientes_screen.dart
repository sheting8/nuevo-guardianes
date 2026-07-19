import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/checklist_repository.dart';
import 'ejecucion_screen.dart';

/// The primary checklist screen: templates that are currently due
/// (`GET /checklists/templates?vencidos=true`). Tapping one opens the
/// execution form. `ANTES_DE_USO` templates never show up as "due" per the
/// API's own due-status logic — this screen doesn't try to work around that.
class PendientesScreen extends StatefulWidget {
  const PendientesScreen({super.key, required this.onLogout});

  final VoidCallback onLogout;

  @override
  State<PendientesScreen> createState() => _PendientesScreenState();
}

class _PendientesScreenState extends State<PendientesScreen> {
  final _repo = ChecklistRepository();
  late Future<List<ChecklistTemplate>> _future;

  @override
  void initState() {
    super.initState();
    _future = _repo.listarPendientes();
  }

  void _refresh() {
    setState(() => _future = _repo.listarPendientes());
  }

  Future<void> _abrir(ChecklistTemplate template) async {
    final completado = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => ChecklistEjecucionScreen(template: template)),
    );
    if (completado == true) _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Checklists pendientes'),
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
        child: FutureBuilder<List<ChecklistTemplate>>(
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
                  error is ApiException ? error.message : 'Error al cargar checklists';
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [Padding(padding: const EdgeInsets.all(24), child: Text(message))],
              );
            }
            final templates = snapshot.data ?? [];
            if (templates.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No hay checklists pendientes.'),
                  ),
                ],
              );
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: templates.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final template = templates[index];
                final count = template.items.length;
                final subtitleParts = [
                  if (template.descripcion != null && template.descripcion!.isNotEmpty)
                    template.descripcion!,
                  '$count ítem${count == 1 ? '' : 's'}',
                ];
                return ListTile(
                  title: Text(template.nombre),
                  subtitle: Text(subtitleParts.join(' · ')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _abrir(template),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
