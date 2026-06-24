import 'package:flutter/widgets.dart';

import 'app/bootstrap.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final root = await bootstrap();
  runApp(root);
}
