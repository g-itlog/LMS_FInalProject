import 'package:flutter/material.dart';
import 'widgets.dart';

ThemeData knowhereTheme() => ThemeData(
  useMaterial3: true,
  fontFamily: 'PublicSans',
  colorScheme: const ColorScheme.light(
    primary: accent,
    onPrimary: Colors.white,
    secondary: Color(0xFFAA4B30),
    onSecondary: Colors.white,
    primaryContainer: Color(0xFFE3E9DC),
    onPrimaryContainer: ink,
    secondaryContainer: Color(0xFFF0E5CD),
    onSecondaryContainer: ink,
    surface: paper,
    onSurface: ink,
    surfaceContainerHighest: Color(0xFFE9EBDD),
    outline: Color(0xFF879487),
    outlineVariant: line,
    error: Color(0xFF9A3F31),
  ),
  scaffoldBackgroundColor: paper,
  appBarTheme: const AppBarTheme(
    backgroundColor: paper,
    foregroundColor: ink,
    surfaceTintColor: Colors.transparent,
    elevation: 0,
    centerTitle: false,
    titleSpacing: 22,
    toolbarHeight: 72,
    titleTextStyle: TextStyle(
      fontFamily: 'PublicSans',
      color: ink,
      fontSize: 17,
      fontWeight: FontWeight.w600,
    ),
  ),
  textTheme: const TextTheme(
    bodyMedium: TextStyle(color: ink, fontSize: 14, height: 1.6),
    bodySmall: TextStyle(color: muted, fontSize: 12, height: 1.6),
    headlineMedium: TextStyle(fontFamily: 'Lora', color: ink, fontSize: 30),
  ),
  dividerTheme: const DividerThemeData(color: line, thickness: 1),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: sheet,
    labelStyle: const TextStyle(color: muted, fontSize: 14),
    hintStyle: const TextStyle(color: muted, fontSize: 14),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(6),
      borderSide: const BorderSide(color: line),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(6),
      borderSide: const BorderSide(color: Color(0xFFCDD4C9)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(6),
      borderSide: const BorderSide(color: accent, width: 1.5),
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      backgroundColor: accent,
      foregroundColor: Colors.white,
      minimumSize: const Size(48, 50),
      textStyle: const TextStyle(
        fontFamily: 'PublicSans',
        fontSize: 13,
        fontWeight: FontWeight.w600,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: accent,
      side: const BorderSide(color: Color(0xFFB6C3B4)),
      minimumSize: const Size(48, 48),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
    ),
  ),
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(
      foregroundColor: accent,
      minimumSize: const Size(44, 44),
      textStyle: const TextStyle(
        fontFamily: 'PublicSans',
        fontSize: 12,
        fontWeight: FontWeight.w600,
      ),
    ),
  ),
  chipTheme: ChipThemeData(
    backgroundColor: paper,
    selectedColor: const Color(0xFFE3E9DC),
    side: const BorderSide(color: line),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
    labelStyle: const TextStyle(color: accent, fontSize: 12),
  ),
  segmentedButtonTheme: SegmentedButtonThemeData(
    style: ButtonStyle(
      minimumSize: const WidgetStatePropertyAll(Size(0, 48)),
      shape: WidgetStatePropertyAll(
        RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      ),
      side: const WidgetStatePropertyAll(BorderSide(color: Color(0xFFB6C3B4))),
      backgroundColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? const Color(0xFFF0E5CD)
            : sheet,
      ),
      foregroundColor: const WidgetStatePropertyAll(ink),
    ),
  ),
  navigationBarTheme: NavigationBarThemeData(
    backgroundColor: sheet,
    surfaceTintColor: Colors.transparent,
    indicatorColor: const Color(0xFFE7EAD9),
    indicatorShape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(7),
    ),
    labelTextStyle: WidgetStateProperty.resolveWith(
      (states) => TextStyle(
        fontFamily: 'PublicSans',
        fontSize: 10,
        color: states.contains(WidgetState.selected) ? ink : muted,
        fontWeight: states.contains(WidgetState.selected)
            ? FontWeight.w700
            : FontWeight.w400,
      ),
    ),
  ),
  snackBarTheme: SnackBarThemeData(
    backgroundColor: ink,
    behavior: SnackBarBehavior.floating,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
  ),
);
