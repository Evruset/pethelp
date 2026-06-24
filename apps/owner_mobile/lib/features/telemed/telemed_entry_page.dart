import 'package:flutter/material.dart';

import 'telemed_page.dart';

class TelemedEntryPage extends StatefulWidget {
  const TelemedEntryPage({super.key});

  @override
  State<TelemedEntryPage> createState() => _TelemedEntryPageState();
}

class _TelemedEntryPageState extends State<TelemedEntryPage> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _open() {
    final sessionId = _controller.text.trim();
    if (sessionId.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => TelemedPage(sessionId: sessionId)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Онлайн-консультация')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              const Text('Открыть консультацию', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              const Text('Введите ID telemed session для проверки local stack и LiveKit development environment.'),
              const SizedBox(height: 24),
              TextField(
                controller: _controller,
                autocorrect: false,
                decoration: const InputDecoration(
                  labelText: 'Telemed session ID',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(onPressed: _open, child: const Text('Открыть консультацию')),
            ],
          ),
        ),
      ),
    );
  }
}
