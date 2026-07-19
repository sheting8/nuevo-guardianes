// Smoke test: the app should boot to the login screen (no session persisted)
// and render its username/password fields. AuthRepository is faked so the
// test never touches the platform secure-storage channel.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:guardianes_mobile/core/auth_repository.dart';
import 'package:guardianes_mobile/main.dart';

class _FakeAuthRepository extends AuthRepository {
  @override
  Future<bool> estaAutenticado() async => false;
}

void main() {
  testWidgets('boots to the login screen with username/password fields', (tester) async {
    await tester.pumpWidget(GuardianesApp(authRepository: _FakeAuthRepository()));

    // Startup gate resolves the persisted-session check asynchronously.
    await tester.pumpAndSettle();

    expect(find.text('Guardianes'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Usuario'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Contraseña'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Ingresar'), findsOneWidget);
  });
}
