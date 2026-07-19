import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/notificaciones_repository.dart';

/// Notification inbox: GET /notificaciones, tap to mark read, and a
/// "marcar todas como leídas" action. Read-only otherwise — no authoring
/// here, that stays a desk/admin (or system-generated) concern.
class NotificacionesScreen extends StatefulWidget {
  const NotificacionesScreen({super.key, required this.onLogout});

  final VoidCallback onLogout;

  @override
  State<NotificacionesScreen> createState() => _NotificacionesScreenState();
}

class _NotificacionesScreenState extends State<NotificacionesScreen> {
  final _repo = NotificacionesRepository();
  late Future<List<Notificacion>> _future;

  @override
  void initState() {
    super.initState();
    _future = _repo.listar();
  }

  void _refresh() {
    setState(() => _future = _repo.listar());
  }

  Future<void> _marcarLeida(Notificacion notificacion) async {
    if (notificacion.leida) return;
    try {
      await _repo.marcarLeida(notificacion.id);
      _refresh();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _marcarTodasLeidas() async {
    try {
      await _repo.marcarTodasLeidas();
      _refresh();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones'),
        actions: [
          IconButton(
            onPressed: _marcarTodasLeidas,
            icon: const Icon(Icons.done_all),
            tooltip: 'Marcar todas como leídas',
          ),
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
        child: FutureBuilder<List<Notificacion>>(
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
                  error is ApiException ? error.message : 'Error al cargar notificaciones';
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [Padding(padding: const EdgeInsets.all(24), child: Text(message))],
              );
            }
            final notificaciones = snapshot.data ?? [];
            if (notificaciones.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No hay notificaciones.'),
                  ),
                ],
              );
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: notificaciones.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final notificacion = notificaciones[index];
                return ListTile(
                  leading: notificacion.leida
                      ? const SizedBox(width: 12)
                      : Container(
                          width: 8,
                          height: 8,
                          margin: const EdgeInsets.only(top: 4, left: 2),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                  title: Text(
                    notificacion.titulo,
                    style: TextStyle(
                      fontWeight: notificacion.leida ? FontWeight.normal : FontWeight.bold,
                    ),
                  ),
                  subtitle: Text(notificacion.cuerpo),
                  onTap: () => _marcarLeida(notificacion),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
