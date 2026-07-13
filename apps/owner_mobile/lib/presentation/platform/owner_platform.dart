import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

bool ownerUsesCupertino({TargetPlatform? platform}) {
  final effectivePlatform = platform ?? defaultTargetPlatform;
  return !kIsWeb && effectivePlatform == TargetPlatform.iOS;
}

Route<T> ownerPageRoute<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  TargetPlatform? platform,
  RouteSettings? settings,
}) {
  if (ownerUsesCupertino(platform: platform)) {
    return CupertinoPageRoute<T>(
      builder: builder,
      settings: settings,
    );
  }
  return MaterialPageRoute<T>(
    builder: builder,
    settings: settings,
  );
}

Future<void> showOwnerMessage(
  BuildContext context,
  String text, {
  TargetPlatform? platform,
}) async {
  if (ownerUsesCupertino(platform: platform)) {
    await showCupertinoDialog<void>(
      context: context,
      builder: (context) => CupertinoAlertDialog(
        title: const Text('VetHelp'),
        content: Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(text),
        ),
        actions: [
          CupertinoDialogAction(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Понятно'),
          ),
        ],
      ),
    );
    return;
  }

  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(text)),
  );
}

Duration ownerMotionDuration(
  BuildContext context,
  Duration duration,
) {
  final mediaQuery = MediaQuery.maybeOf(context);
  if (mediaQuery == null) return duration;
  if (mediaQuery.disableAnimations || mediaQuery.accessibleNavigation) {
    return Duration.zero;
  }
  return duration;
}
