import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class VhPageBackdrop extends StatelessWidget {
  const VhPageBackdrop({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color.alphaBlend(
              colors.primaryContainer.withValues(alpha: 0.34),
              colors.surface,
            ),
            colors.surface,
            Color.alphaBlend(
              colors.secondaryContainer.withValues(alpha: 0.18),
              colors.surface,
            ),
          ],
        ),
      ),
      child: child,
    );
  }
}

class VhGlassSurface extends StatelessWidget {
  const VhGlassSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.radius = 24,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.surface.withValues(alpha: 0.82),
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(
              color: colors.outlineVariant.withValues(alpha: 0.5),
            ),
            boxShadow: [
              BoxShadow(
                color: colors.shadow.withValues(alpha: 0.08),
                blurRadius: 24,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Padding(
            padding: padding,
            child: child,
          ),
        ),
      ),
    );
  }
}

class VhSectionHeading extends StatelessWidget {
  const VhSectionHeading({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final textTheme = CupertinoTheme.of(context).textTheme;

    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: textTheme.textStyle.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 18,
            ),
          ),
        ),
        if (actionLabel != null && onAction != null)
          CupertinoButton(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            minSize: 44,
            onPressed: onAction,
            child: Text(actionLabel!),
          ),
      ],
    );
  }
}

class VhPetSummary extends StatelessWidget {
  const VhPetSummary({
    super.key,
    required this.name,
    required this.subtitle,
    required this.onPressed,
  });

  final String name;
  final String subtitle;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final textTheme = CupertinoTheme.of(context).textTheme;

    return Semantics(
      button: true,
      label: '$name. $subtitle',
      child: CupertinoButton(
        padding: EdgeInsets.zero,
        minSize: 44,
        onPressed: onPressed,
        child: VhGlassSurface(
          child: Row(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: colors.primaryContainer,
                  borderRadius: BorderRadius.circular(22),
                ),
                child: Icon(
                  CupertinoIcons.paw_solid,
                  color: colors.primary,
                  size: 32,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: textTheme.textStyle.copyWith(
                        color: colors.onSurface,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: textTheme.textStyle.copyWith(
                        color: colors.onSurfaceVariant,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Профиль питомца ›',
                      style: textTheme.textStyle.copyWith(
                        color: colors.primary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                CupertinoIcons.chevron_forward,
                color: colors.onSurfaceVariant,
                size: 18,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class VhServiceTile extends StatelessWidget {
  const VhServiceTile({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onPressed,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final textTheme = CupertinoTheme.of(context).textTheme;

    return Semantics(
      button: true,
      label: '$title. $subtitle',
      child: CupertinoButton(
        padding: EdgeInsets.zero,
        minSize: 44,
        onPressed: onPressed,
        child: VhGlassSurface(
          padding: const EdgeInsets.all(14),
          radius: 20,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: colors.primaryContainer,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: colors.primary, size: 22),
              ),
              const Spacer(),
              Text(
                title,
                style: textTheme.textStyle.copyWith(
                  color: colors.onSurface,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: textTheme.textStyle.copyWith(
                  color: colors.onSurfaceVariant,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class VhUrgentBanner extends StatelessWidget {
  const VhUrgentBanner({
    super.key,
    required this.onPressed,
  });

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final textTheme = CupertinoTheme.of(context).textTheme;

    return Semantics(
      button: true,
      label: 'Срочная помощь. Открыть список срочных клиник сейчас.',
      child: CupertinoButton(
        padding: EdgeInsets.zero,
        minSize: 44,
        onPressed: onPressed,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.errorContainer.withValues(alpha: 0.9),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: colors.error.withValues(alpha: 0.18),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Icon(
                  CupertinoIcons.exclamationmark_triangle_fill,
                  color: colors.error,
                  size: 28,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Срочная помощь',
                        style: textTheme.textStyle.copyWith(
                          color: colors.onErrorContainer,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Круглосуточная помощь рядом',
                        style: textTheme.textStyle.copyWith(
                          color: colors.onErrorContainer.withValues(alpha: 0.72),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  CupertinoIcons.arrow_right_circle_fill,
                  color: colors.error,
                  size: 24,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
