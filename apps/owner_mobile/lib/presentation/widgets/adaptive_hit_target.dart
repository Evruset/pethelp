import 'package:flutter/widgets.dart';

const double kVetHelpMinTapTarget = 44;

class AdaptiveHitTarget extends StatelessWidget {
  const AdaptiveHitTarget({
    super.key,
    required this.child,
    this.onTap,
    this.semanticLabel,
    this.enabled = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final String? semanticLabel;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final content = ConstrainedBox(
      constraints: const BoxConstraints(
        minWidth: kVetHelpMinTapTarget,
        minHeight: kVetHelpMinTapTarget,
      ),
      child: Center(child: child),
    );

    final semanticContent = Semantics(
      button: onTap != null,
      enabled: enabled,
      label: semanticLabel,
      child: content,
    );

    if (onTap == null || !enabled) return semanticContent;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: semanticContent,
    );
  }
}
