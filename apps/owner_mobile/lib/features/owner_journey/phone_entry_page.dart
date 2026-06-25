import 'package:flutter/material.dart';

/// Temporary account boundary for the public journey.
///
/// OTP endpoints are intentionally not simulated here. Until the backend auth
/// API is available, entering a phone number only explains the next step and
/// does not create an account or store a token on-device.
class PhoneEntryPage extends StatefulWidget {
  const PhoneEntryPage({super.key, required this.onBack});

  final VoidCallback onBack;

  @override
  State<PhoneEntryPage> createState() => _PhoneEntryPageState();
}

class _PhoneEntryPageState extends State<PhoneEntryPage> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: BackButton(onPressed: widget.onBack), title: const Text('Вход в VetHelp')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text('Сохраним ваши обращения', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            const Text(
              'Номер нужен только для подтверждения записи, доступа к кабинету и нейтральных уведомлений. Медицинские детали не передаются в SMS или мессенджерах.',
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _controller,
              keyboardType: TextInputType.phone,
              autofillHints: const [AutofillHints.telephoneNumber],
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: 'Номер телефона',
                hintText: '+7 900 000-00-00',
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _controller.text.trim().length < 5
                  ? null
                  : () => _showAuthUnavailable(context),
              child: const Text('Получить код'),
            ),
            const SizedBox(height: 12),
            Text(
              'В этой сборке OTP не эмулируется: аккаунт создаётся только после подключения защищённого backend auth API.',
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  void _showAuthUnavailable(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('OTP-вход будет включён вместе с защищённым auth API.'),
      ),
    );
  }
}
