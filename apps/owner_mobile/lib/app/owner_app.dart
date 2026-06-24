import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../features/booking/alternative_slot/alternative_slot_entry_page.dart';

class VetHelpOwnerApp extends StatelessWidget {
  const VetHelpOwnerApp({super.key});

  @override
  Widget build(BuildContext context) {
    if (Platform.isIOS) {
      return const CupertinoApp(
        debugShowCheckedModeBanner: false,
        home: AlternativeSlotEntryPage(),
      );
    }
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2457D6)),
        useMaterial3: true,
      ),
      home: const AlternativeSlotEntryPage(),
    );
  }
}
