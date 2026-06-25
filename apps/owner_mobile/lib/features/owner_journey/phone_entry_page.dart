import 'package:flutter/material.dart';

import '../auth/owner_auth_repository.dart';
import '../auth/owner_session.dart';

class PhoneEntryPage extends StatefulWidget {
  const PhoneEntryPage({
    super.key,
    required this.onBack,
    required this.repository,
    required this.onAuthenticated,
  });

  final VoidCallback onBack;
  final OwnerAuthRepository repository;
  final ValueChanged<OwnerSession> onAuthenticated;

  @override
  State<PhoneEntryPage> createState() => _PhoneEntryPageState();
}

class _PhoneEntryPageState extends State<PhoneEntryPage> {
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  OtpChallenge? _challenge;
  bool _loading = false;
  String? _error;

  bool get _canRequestCode => _phoneController.text.trim().length >= 8;
  bool get _canVerifyCode => _challenge != null && RegExp(r'^\d{6}$').hasMatch(_codeController.text.trim());

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _requestCode() async {
    if (!_canRequestCode || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final challenge = await widget.repository.requestOtp(_phoneController.text.trim());
      if (!mounted) return;
      setState(() {
        _challenge = challenge;
        _codeController.clear();
      });
    } on OwnerAuthApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = _requestError(error));
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Не удалось запросить код. Проверьте подключение и повторите попытку.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyCode() async {
    final challenge = _challenge;
    if (!_canVerifyCode || challenge == null || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await widget.repository.verifyOtp(
        phone: _phoneController.text.trim(),
        challengeId: challenge.id,
        code: _codeController.text.trim(),
        deviceName: 'VetHelp owner app',
      );
      if (!mounted) return;
      widget.onAuthenticated(session);
    } on OwnerAuthApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = _verifyError(error));
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Не удалось подтвердить код. Повторите попытку.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final challenge = _challenge;
    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: widget.onBack),
        title: const Text('Вход в VetHelp'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              challenge == null ? 'Сохраним ваши обращения' : 'Введите код',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              challenge == null
                  ? 'Номер нужен для доступа к кабинету, записи и нейтральных уведомлений. Медицинские детали не передаются в SMS.'
                  : 'Код действует пять минут. После подтверждения откроется ваш кабинет владельца.',
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              autofillHints: const [AutofillHints.telephoneNumber],
              enabled: !_loading && challenge == null,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: 'Номер телефона',
                hintText: '+7 900 000-00-00',
              ),
            ),
            if (challenge != null) ...[
              const SizedBox(height: 16),
              TextField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                autofillHints: const [AutofillHints.oneTimeCode],
                maxLength: 6,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Код из SMS',
                  hintText: '000000',
                ),
              ),
              if (challenge.developmentCode case final code?) ...[
                const SizedBox(height: 8),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text('Код для local development: $code'),
                  ),
                ),
              ],
            ],
            if (_error case final error?) ...[
              const SizedBox(height: 16),
              Text(error, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _loading ? null : (challenge == null ? _requestCode : _verifyCode),
              child: Text(_loading ? 'Проверяем…' : challenge == null ? 'Получить код' : 'Подтвердить вход'),
            ),
            if (challenge != null) ...[
              const SizedBox(height: 12),
              TextButton(
                onPressed: _loading ? null : () => setState(() {
                  _challenge = null;
                  _codeController.clear();
                  _error = null;
                }),
                child: const Text('Изменить номер'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _requestError(OwnerAuthApiException error) => switch (error.code) {
        'INVALID_PHONE' => 'Введите номер в международном формате, например +79991234567.',
        'OTP_RATE_LIMITED' => 'Код уже отправлен. Подождите минуту и повторите попытку.',
        'OTP_DELIVERY_UNAVAILABLE' => 'Доставка кодов временно недоступна.',
        _ => 'Не удалось запросить код. Повторите попытку.',
      };

  String _verifyError(OwnerAuthApiException error) => switch (error.code) {
        'OTP_VERIFICATION_FAILED' => 'Код неверный, истёк или уже использован.',
        'INVALID_OTP_CODE' => 'Введите шестизначный код.',
        _ => 'Не удалось подтвердить код. Повторите попытку.',
      };
}
