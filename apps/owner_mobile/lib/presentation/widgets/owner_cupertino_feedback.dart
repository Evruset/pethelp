import 'package:flutter/cupertino.dart';

enum OwnerCupertinoFeedbackTone {
  neutral,
  warning,
  destructive,
}

class OwnerCupertinoSectionHeader extends StatelessWidget {
  const OwnerCupertinoSectionHeader({
    super.key,
    required this.title,
    this.supportingText,
    this.trailing,
  });

  final String title;
  final String? supportingText;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final textTheme = CupertinoTheme.of(context).textTheme;
    final secondary = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                ownerCupertinoVisibleText(title),
                style: textTheme.textStyle.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (supportingText != null) ...[
                const SizedBox(height: 3),
                Text(
                  ownerCupertinoVisibleText(supportingText!),
                  style: textTheme.textStyle.copyWith(
                    color: secondary,
                    fontSize: 13,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: 12),
          trailing!,
        ],
      ],
    );
  }
}

class OwnerCupertinoButton extends StatelessWidget {
  const OwnerCupertinoButton.primary({
    super.key,
    required this.label,
    required this.onPressed,
    this.enabled = true,
    this.loading = false,
    this.semanticLabel,
  })  : _style = _OwnerCupertinoButtonStyle.primary,
        icon = null;

  const OwnerCupertinoButton.secondary({
    super.key,
    required this.label,
    required this.onPressed,
    this.enabled = true,
    this.loading = false,
    this.semanticLabel,
    this.icon,
  }) : _style = _OwnerCupertinoButtonStyle.secondary;

  const OwnerCupertinoButton.destructive({
    super.key,
    required this.label,
    required this.onPressed,
    this.enabled = true,
    this.loading = false,
    this.semanticLabel,
    this.icon,
  }) : _style = _OwnerCupertinoButtonStyle.destructive;

  final String label;
  final VoidCallback? onPressed;
  final bool enabled;
  final bool loading;
  final String? semanticLabel;
  final IconData? icon;
  final _OwnerCupertinoButtonStyle _style;

  @override
  Widget build(BuildContext context) {
    final disabled = !enabled || onPressed == null || loading;
    final foreground = _foreground(context, disabled);
    final background = _background(context, disabled);
    final border = _border(context, disabled);
    final content = Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (loading) ...[
          CupertinoActivityIndicator(color: foreground),
          const SizedBox(width: 10),
        ] else if (icon != null) ...[
          Icon(icon, color: foreground, size: 18),
          const SizedBox(width: 8),
        ],
        Flexible(
          child: Text(
            ownerCupertinoVisibleText(label),
            overflow: TextOverflow.ellipsis,
            style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                  color: foreground,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
      ],
    );

    return Semantics(
      button: true,
      enabled: !disabled,
      label: semanticLabel ?? ownerCupertinoVisibleText(label),
      child: SizedBox(
        width: double.infinity,
        child: CupertinoButton(
          minSize: 52,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          color: background,
          borderRadius: BorderRadius.circular(14),
          onPressed: disabled ? null : onPressed,
          child: DecoratedBox(
            decoration: BoxDecoration(
              border: border == null ? null : Border.all(color: border),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Padding(
              padding: EdgeInsets.zero,
              child: content,
            ),
          ),
        ),
      ),
    );
  }

  Color _foreground(BuildContext context, bool disabled) {
    if (disabled) {
      return CupertinoDynamicColor.resolve(
        CupertinoColors.secondaryLabel,
        context,
      );
    }
    return switch (_style) {
      _OwnerCupertinoButtonStyle.primary => CupertinoColors.white,
      _OwnerCupertinoButtonStyle.secondary => CupertinoDynamicColor.resolve(
          CupertinoColors.activeBlue,
          context,
        ),
      _OwnerCupertinoButtonStyle.destructive => CupertinoDynamicColor.resolve(
          CupertinoColors.systemRed,
          context,
        ),
    };
  }

  Color _background(BuildContext context, bool disabled) {
    if (disabled) {
      return CupertinoDynamicColor.resolve(
        CupertinoColors.tertiarySystemFill,
        context,
      );
    }
    return switch (_style) {
      _OwnerCupertinoButtonStyle.primary => CupertinoDynamicColor.resolve(
          CupertinoColors.activeBlue,
          context,
        ),
      _OwnerCupertinoButtonStyle.secondary ||
      _OwnerCupertinoButtonStyle.destructive =>
        CupertinoDynamicColor.resolve(
          CupertinoColors.secondarySystemGroupedBackground,
          context,
        ),
    };
  }

  Color? _border(BuildContext context, bool disabled) {
    if (_style == _OwnerCupertinoButtonStyle.primary && !disabled) return null;
    return CupertinoDynamicColor.resolve(
      disabled
          ? CupertinoColors.separator
          : _style == _OwnerCupertinoButtonStyle.destructive
              ? CupertinoColors.systemRed
              : CupertinoColors.separator,
      context,
    );
  }
}

class OwnerCupertinoStatusBanner extends StatelessWidget {
  const OwnerCupertinoStatusBanner({
    super.key,
    required this.tone,
    required this.message,
    this.title,
    this.icon,
    this.actionLabel,
    this.onAction,
    this.destructiveAction = false,
    this.liveRegion = false,
  });

  final OwnerCupertinoFeedbackTone tone;
  final String? title;
  final String message;
  final IconData? icon;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool destructiveAction;
  final bool liveRegion;

  @override
  Widget build(BuildContext context) {
    final palette = _OwnerCupertinoTonePalette.resolve(context, tone);
    final visibleTitle =
        title == null ? null : ownerCupertinoVisibleText(title!);
    final visibleMessage = ownerCupertinoVisibleText(message);
    return Semantics(
      liveRegion: liveRegion,
      label: [
        if (visibleTitle != null) visibleTitle,
        visibleMessage,
      ].join('. '),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: palette.background,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: palette.border),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon ?? palette.icon, color: palette.foreground, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (visibleTitle != null) ...[
                      Text(
                        visibleTitle,
                        style: CupertinoTheme.of(context)
                            .textTheme
                            .textStyle
                            .copyWith(
                              color: palette.foreground,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      const SizedBox(height: 3),
                    ],
                    Text(visibleMessage),
                    if (actionLabel != null && onAction != null) ...[
                      const SizedBox(height: 10),
                      if (destructiveAction)
                        OwnerCupertinoButton.destructive(
                          label: actionLabel!,
                          onPressed: onAction,
                          icon: CupertinoIcons.exclamationmark_triangle,
                          semanticLabel:
                              ownerCupertinoVisibleText(actionLabel!),
                        )
                      else
                        OwnerCupertinoButton.secondary(
                          label: actionLabel!,
                          onPressed: onAction,
                          icon: CupertinoIcons.arrow_clockwise,
                          semanticLabel:
                              ownerCupertinoVisibleText(actionLabel!),
                        ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class OwnerCupertinoEmptyState extends StatelessWidget {
  const OwnerCupertinoEmptyState({
    super.key,
    required this.title,
    required this.message,
    this.icon = CupertinoIcons.tray,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final secondary = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(icon, size: 42, color: secondary),
            const SizedBox(height: 12),
            Text(
              ownerCupertinoVisibleText(title),
              textAlign: TextAlign.center,
              style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 6),
            Text(
              ownerCupertinoVisibleText(message),
              textAlign: TextAlign.center,
              style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                    color: secondary,
                  ),
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 16),
              OwnerCupertinoButton.primary(
                label: actionLabel!,
                onPressed: onAction,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class OwnerCupertinoInlineError extends StatelessWidget {
  const OwnerCupertinoInlineError({
    super.key,
    required this.title,
    required this.message,
    required this.retryLabel,
    required this.onRetry,
  });

  final String title;
  final String message;
  final String retryLabel;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return OwnerCupertinoStatusBanner(
      tone: OwnerCupertinoFeedbackTone.warning,
      title: title,
      message: message,
      icon: CupertinoIcons.exclamationmark_circle,
      actionLabel: retryLabel,
      onAction: onRetry,
      liveRegion: true,
    );
  }
}

class OwnerCupertinoLoading extends StatelessWidget {
  const OwnerCupertinoLoading({
    super.key,
    this.label,
    this.compact = false,
  });

  final String? label;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final visibleLabel =
        label == null ? null : ownerCupertinoVisibleText(label!);
    final content = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const CupertinoActivityIndicator(),
        if (visibleLabel != null) ...[
          const SizedBox(height: 10),
          Text(
            visibleLabel,
            textAlign: TextAlign.center,
            style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                  color: CupertinoDynamicColor.resolve(
                    CupertinoColors.secondaryLabel,
                    context,
                  ),
                ),
          ),
        ],
      ],
    );
    if (compact) return Center(child: content);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: content,
      ),
    );
  }
}

String ownerCupertinoVisibleText(String value, {String? fallback}) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return fallback ?? 'Попробуйте повторить действие.';
  final hasRawState =
      RegExp(r'\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b').hasMatch(trimmed);
  final hasHttpStatus = RegExp(r'\b[45]\d\d\b').hasMatch(trimmed);
  final hasQueueId = RegExp(r'\b(queue|session|hold|trace|uuid)[-_]?[a-z0-9]+',
          caseSensitive: false)
      .hasMatch(trimmed);
  if (hasRawState || hasHttpStatus || hasQueueId) {
    return fallback ?? 'Состояние обновляется. Попробуйте повторить действие.';
  }
  return trimmed;
}

enum _OwnerCupertinoButtonStyle { primary, secondary, destructive }

class _OwnerCupertinoTonePalette {
  const _OwnerCupertinoTonePalette({
    required this.background,
    required this.border,
    required this.foreground,
    required this.icon,
  });

  final Color background;
  final Color border;
  final Color foreground;
  final IconData icon;

  static _OwnerCupertinoTonePalette resolve(
    BuildContext context,
    OwnerCupertinoFeedbackTone tone,
  ) {
    final foreground = switch (tone) {
      OwnerCupertinoFeedbackTone.neutral => CupertinoColors.activeBlue,
      OwnerCupertinoFeedbackTone.warning => CupertinoColors.systemYellow,
      OwnerCupertinoFeedbackTone.destructive => CupertinoColors.systemRed,
    };
    final icon = switch (tone) {
      OwnerCupertinoFeedbackTone.neutral => CupertinoIcons.info_circle,
      OwnerCupertinoFeedbackTone.warning =>
        CupertinoIcons.exclamationmark_triangle,
      OwnerCupertinoFeedbackTone.destructive =>
        CupertinoIcons.exclamationmark_octagon,
    };
    return _OwnerCupertinoTonePalette(
      background: CupertinoDynamicColor.resolve(
        switch (tone) {
          OwnerCupertinoFeedbackTone.neutral =>
            CupertinoColors.tertiarySystemFill,
          OwnerCupertinoFeedbackTone.warning =>
            CupertinoColors.systemYellow.withValues(alpha: 0.18),
          OwnerCupertinoFeedbackTone.destructive =>
            CupertinoColors.systemRed.withValues(alpha: 0.14),
        },
        context,
      ),
      border: CupertinoDynamicColor.resolve(
        switch (tone) {
          OwnerCupertinoFeedbackTone.neutral => CupertinoColors.separator,
          OwnerCupertinoFeedbackTone.warning => CupertinoColors.systemYellow,
          OwnerCupertinoFeedbackTone.destructive => CupertinoColors.systemRed,
        },
        context,
      ),
      foreground: CupertinoDynamicColor.resolve(foreground, context),
      icon: icon,
    );
  }
}
