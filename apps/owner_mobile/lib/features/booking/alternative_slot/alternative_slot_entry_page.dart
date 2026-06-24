import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import 'alternative_slot_page.dart';

class AlternativeSlotEntryPage extends StatefulWidget {
  const AlternativeSlotEntryPage({super.key});

  @override
  State<AlternativeSlotEntryPage> createState() => _AlternativeSlotEntryPageState();
}

class _AlternativeSlotEntryPageState extends State<AlternativeSlotEntryPage> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _open() {
    final holdId = _controller.text.trim();
    if (holdId.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => AlternativeSlotPage(holdId: holdId)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('VetHelp')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              const Text('Предложение другого времени', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              const Text('Введите ID активного hold для локальной проверки альтернативного слота.'),
              const SizedBox(height: 24),
              TextField(
                controller: _controller,
                autocorrect: false,
                decoration: const InputDecoration(
                  labelText: 'Hold ID',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _open,
                child: const Text('Открыть запись'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
