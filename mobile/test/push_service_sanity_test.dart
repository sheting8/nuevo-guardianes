import 'package:flutter_test/flutter_test.dart';
import 'package:guardianes_mobile/core/push_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('inicializar() never throws even without a real Firebase project', () async {
    await PushService.instance.inicializar();
    expect(PushService.instance.token, isNull);
  });
}
