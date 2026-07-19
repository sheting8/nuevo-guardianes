import 'package:flutter/material.dart';

import 'core/auth_repository.dart';
import 'core/push_service.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_shell.dart';

void main() {
  runApp(GuardianesApp());
}

class GuardianesApp extends StatelessWidget {
  /// [authRepository] is overridable so widget tests can inject a fake that
  /// doesn't touch the platform secure-storage channel.
  GuardianesApp({super.key, AuthRepository? authRepository})
      : _authRepository = authRepository ?? AuthRepository();

  final AuthRepository _authRepository;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Guardianes',
      // Lets PushService show foreground push notifications as a SnackBar
      // without needing a BuildContext of its own.
      scaffoldMessengerKey: scaffoldMessengerKey,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepOrange),
        useMaterial3: true,
      ),
      home: _StartupGate(authRepository: _authRepository),
    );
  }
}

/// Decides whether to land on the login screen or straight into the app
/// shell, based on whether a session is already persisted.
class _StartupGate extends StatelessWidget {
  const _StartupGate({required this.authRepository});

  final AuthRepository authRepository;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: authRepository.estaAutenticado(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        return snapshot.data! ? const HomeShell() : const LoginScreen();
      },
    );
  }
}
