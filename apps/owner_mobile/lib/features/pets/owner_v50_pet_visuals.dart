import 'package:flutter/material.dart';

import 'owner_pet.dart';

class OwnerV50PetPageFrame extends StatelessWidget {
  const OwnerV50PetPageFrame({
    super.key,
    required this.title,
    required this.supportingText,
    required this.child,
    this.eyebrow = 'Личный кабинет владельца',
    this.leading,
    this.status,
    this.maxWidth = 1180,
  });

  final String title;
  final String supportingText;
  final Widget child;
  final String eyebrow;
  final Widget? leading;
  final Widget? status;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return ColoredBox(
      color: colors.surfaceContainerLowest,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 768;
          return SingleChildScrollView(
            key: const ValueKey('owner-v50-pet-page-scroll'),
            padding: EdgeInsets.fromLTRB(
              compact ? 16 : 28,
              compact ? 18 : 28,
              compact ? 16 : 28,
              compact ? 32 : 48,
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: maxWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (leading != null) ...[
                      Align(alignment: Alignment.centerLeft, child: leading!),
                      const SizedBox(height: 10),
                    ],
                    Row(
                      children: [
                        Icon(Icons.circle, size: 8, color: colors.primary),
                        const SizedBox(width: 7),
                        Expanded(
                          child: Text(
                            eyebrow,
                            style: Theme.of(context)
                                .textTheme
                                .labelMedium
                                ?.copyWith(
                                  color: colors.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      title,
                      key: const ValueKey('owner-v50-page-title'),
                      style: (compact
                              ? Theme.of(context).textTheme.headlineMedium
                              : Theme.of(context).textTheme.displaySmall)
                          ?.copyWith(fontWeight: FontWeight.w800, height: 1.08),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      supportingText,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: colors.onSurfaceVariant,
                          ),
                    ),
                    if (status != null) ...[
                      const SizedBox(height: 18),
                      status!,
                    ],
                    SizedBox(height: compact ? 20 : 26),
                    child,
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class OwnerV50InsetSection extends StatelessWidget {
  const OwnerV50InsetSection({
    super.key,
    required this.child,
    this.title,
    this.trailing,
    this.padding = const EdgeInsets.all(20),
    this.tone,
  });

  final Widget child;
  final String? title;
  final Widget? trailing;
  final EdgeInsetsGeometry padding;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: tone ?? colors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: colors.outlineVariant),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(alpha: .06),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (title != null || trailing != null) ...[
              Row(
                children: [
                  if (title != null)
                    Expanded(
                      child: Text(
                        title!,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    )
                  else
                    const Spacer(),
                  if (trailing != null) trailing!,
                ],
              ),
              const SizedBox(height: 16),
            ],
            child,
          ],
        ),
      ),
    );
  }
}

class OwnerV50StatusBanner extends StatelessWidget {
  const OwnerV50StatusBanner({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.action,
    this.warning = false,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;
  final bool warning;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final background =
        warning ? colors.errorContainer : colors.tertiaryContainer;
    final foreground =
        warning ? colors.onErrorContainer : colors.onTertiaryContainer;
    return Semantics(
      container: true,
      liveRegion: true,
      label: '$title. $message',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: foreground),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            color: foreground,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 3),
                    Text(message, style: TextStyle(color: foreground)),
                  ],
                ),
              ),
              if (action != null) ...[
                const SizedBox(width: 8),
                action!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class OwnerV50PetAvatar extends StatelessWidget {
  const OwnerV50PetAvatar({
    super.key,
    required this.pet,
    this.size = 72,
    this.rounded = true,
  });

  final OwnerPet pet;
  final double size;
  final bool rounded;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final url = pet.photoUrl?.trim();
    final image = url == null || url.isEmpty
        ? null
        : NetworkImage(url) as ImageProvider<Object>;
    return Semantics(
      image: true,
      label: 'Фото питомца ${pet.name}',
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: colors.primaryContainer,
          borderRadius: BorderRadius.circular(rounded ? 18 : size / 2),
          image: image == null
              ? null
              : DecorationImage(image: image, fit: BoxFit.cover),
        ),
        alignment: Alignment.center,
        child: image == null
            ? Icon(Icons.pets, size: size * .42, color: colors.primary)
            : null,
      ),
    );
  }
}

String ownerPetSpeciesLabel(String species) => switch (species) {
      'DOG' => 'Собака',
      'CAT' => 'Кошка',
      _ => 'Питомец',
    };
