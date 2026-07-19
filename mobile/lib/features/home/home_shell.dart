import 'package:flutter/material.dart';

import '../../core/auth_repository.dart';
import '../../core/push_service.dart';
import '../auth/login_screen.dart';
import '../checklists/pendientes_screen.dart';
import '../inventario/inventario_screen.dart';
import '../notificaciones/notificaciones_screen.dart';

/// Minimal bottom-nav shell tying together the mobile-scoped features:
/// checklist "pendientes", read-only inventory browsing, notifications, plus
/// logout.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  final _authRepository = AuthRepository();

  Future<void> _logout() async {
    // Best-effort: never let a push-deregistration failure block logout.
    await PushService.instance.eliminarDispositivoActual();
    await _authRepository.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      PendientesScreen(onLogout: _logout),
      InventarioScreen(onLogout: _logout),
      NotificacionesScreen(onLogout: _logout),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.checklist), label: 'Pendientes'),
          NavigationDestination(icon: Icon(Icons.inventory_2), label: 'Inventario'),
          NavigationDestination(icon: Icon(Icons.notifications), label: 'Notificaciones'),
        ],
      ),
    );
  }
}
