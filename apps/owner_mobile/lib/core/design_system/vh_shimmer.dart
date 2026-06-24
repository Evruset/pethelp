import 'package:flutter/material.dart';

class VhShimmer extends StatefulWidget {
  const VhShimmer({
    required this.child,
    super.key,
  });

  final Widget child;

  @override
  State<VhShimmer> createState() => _VhShimmerState();
}

class _VhShimmerState extends State<VhShimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (reduceMotion) return widget.child;
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) => LinearGradient(
            begin: Alignment(-1.0 - _controller.value * 2, 0),
            end: Alignment(1.0 - _controller.value * 2, 0),
            colors: const <Color>[Color(0xFFE8ECF2), Color(0xFFF8FAFC), Color(0xFFE8ECF2)],
            stops: const <double>[0.15, 0.5, 0.85],
          ).createShader(bounds),
          child: child,
        );
      },
    );
  }
}
