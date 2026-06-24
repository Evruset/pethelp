import 'package:flutter/material.dart';

import '../../telemed/telemed_entry_page.dart';
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

  void _openHold() {
    final holdId = _controller.text.trim();
    if (holdId.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => AlternativeSlotPage(holdId: holdId)),
    );
  }

  void _openTelemed() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const TelemedEntryPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('VetHelp')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: <Widget>[
            const Text('Локальные сценарии VetHelp', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            const Text('Экран предназначен для проверки готовых owner journeys против local stack.'),
            const SizedBox(height: 28),
            const Text('Предложение другого времени', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            const Text('Введите ID активного hold, чтобы проверить атомарный accept/decline альтернативного slot.'),
            const SizedBox(height: 16),
            TextField(
              controller: _controller,
              autocorrect: false,
              decoration: const InputDecoration(labelText: 'Hold ID', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            FilledButton(onPressed: _openHold, child: const Text('Открыть запись')),
            const SizedBox(height: 28),
            const Divider(),
            const SizedBox(height: 20),
            const Text('Онлайн-консультация', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            const Text('Откройте session ID, чтобы проверить ожидание врача, LiveKit call и сценарий завершения.'),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: _openTelemed, child: const Text('Открыть консультацию')),
          ],
        ),
      ),
    );
  }
}
