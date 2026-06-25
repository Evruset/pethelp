import 'package:flutter/material.dart';

import 'features/booking/alternative_slot/alternative_slot_page.dart';
import 'features/booking/alternative_slot/alternative_slot_repository.dart';
import 'features/telemed/waiting_room/telemed_waiting_room_page.dart';
import 'features/telemed/waiting_room/telemed_waiting_room_repository.dart';

void main() {
  runApp(const VetHelpOwnerApp());
}

class VetHelpOwnerApp extends StatelessWidget {
  const VetHelpOwnerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VetHelp',
      theme: ThemeData(colorSchemeSeed: Colors.teal, useMaterial3: true),
      home: const OwnerJourneyLauncher(),
    );
  }
}

class OwnerJourneyLauncher extends StatefulWidget {
  const OwnerJourneyLauncher({super.key});

  @override
  State<OwnerJourneyLauncher> createState() => _OwnerJourneyLauncherState();
}

class _OwnerJourneyLauncherState extends State<OwnerJourneyLauncher> {
  final _idController = TextEditingController();
  final _apiBaseUrl = const String.fromEnvironment('VETHELP_API_BASE_URL', defaultValue: 'http://10.0.2.2:3000');
  final _ownerJwt = const String.fromEnvironment('VETHELP_OWNER_JWT');

  @override
  void dispose() {
    _idController.dispose();
    super.dispose();
  }

  Future<String> _token() async {
    if (_ownerJwt.isEmpty) {
      throw StateError('Provide VETHELP_OWNER_JWT only for local development.');
    }
    return _ownerJwt;
  }

  void _openAlternative() {
    final holdId = _idController.text.trim();
    if (holdId.isEmpty) return;
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => AlternativeSlotPage(
        holdId: holdId,
        repository: AlternativeSlotRepository(baseUrl: Uri.parse(_apiBaseUrl), accessTokenProvider: _token),
      ),
    ));
  }

  void _openTelemed() {
    final sessionId = _idController.text.trim();
    if (sessionId.isEmpty) return;
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => TelemedWaitingRoomPage(
        sessionId: sessionId,
        repository: HttpTelemedWaitingRepository(baseUrl: Uri.parse(_apiBaseUrl), accessTokenProvider: _token),
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('VetHelp owner · dev launcher')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Для local development передайте UUID hold или telemed session и `--dart-define` для API/JWT.'),
            const SizedBox(height: 16),
            TextField(
              controller: _idController,
              autocorrect: false,
              decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'Hold или session UUID'),
            ),
            const SizedBox(height: 12),
            FilledButton(onPressed: _openAlternative, child: const Text('Открыть альтернативный слот')),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: _openTelemed, child: const Text('Открыть ожидание телемедицины')),
            const SizedBox(height: 24),
            Text('API: $_apiBaseUrl', style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 4),
            Text(_ownerJwt.isEmpty ? 'JWT: не задан' : 'JWT: задан только через dart-define', style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
