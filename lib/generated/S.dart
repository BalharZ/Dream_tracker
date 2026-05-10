import 'package:flutter/widgets.dart';

class S {
  final Locale locale;

  S(this.locale);

  static S of(BuildContext context) =>
      Localizations.of<S>(context, S) ?? S(const Locale('en'));

  static const LocalizationsDelegate<S> delegate = _SDelegate();

  static const List<Locale> supportedLocales = [
    Locale('en'),
    Locale('cs'),
  ];

  bool get _isCzech => locale.languageCode == 'cs';

  // App
  String get appName => 'Dream Tracker';

  // Menu
  String get menuTitle => _isCzech ? 'Menu' : 'Menu';
  String get menuHome => _isCzech ? 'Domů' : 'Home';
  String get menuHabits => _isCzech ? 'Návyky' : 'Habits';
  String get menuDreams => _isCzech ? 'Sny' : 'Dreams';
  String get menuGoals => _isCzech ? 'Cíle' : 'Goals';
  String get menuRewards => _isCzech ? 'Odměny' : 'Rewards';
  String get menuLogout => _isCzech ? 'Odhlásit se' : 'Logout';
  String get mainMenuTitle => _isCzech ? 'Hlavní menu' : 'Main Menu';
  String get logout => _isCzech ? 'Odhlásit se' : 'Logout';

  // Login
  String get loginTitle => _isCzech ? 'Přihlášení' : 'Login';
  String get emailLabel => 'Email';
  String get passwordLabel => _isCzech ? 'Heslo' : 'Password';
  String get loginButton => _isCzech ? 'Přihlásit se' : 'Log in';
  String get registerButton => _isCzech ? 'Registrovat se' : 'Register';
  String get loginWelcomeMessage =>
      _isCzech ? 'Vítejte v Dream Tracker!' : 'Welcome to Dream Tracker!';
  String get noAccount =>
      _isCzech ? 'Nemáte účet? Zaregistrujte se' : "Don't have an account? Register";
  String get hasAccount =>
      _isCzech ? 'Už máte účet? Přihlašte se' : 'Already have an account? Log in';

  // Home
  String get homeTitle => _isCzech ? 'Domů' : 'Home';
  String get welcomeMessage =>
      _isCzech ? 'Vítejte v Dream Tracker!' : 'Welcome to Dream Tracker!';

  // Dreams
  String get dreamsTitle => _isCzech ? 'Sny' : 'Dreams';
  String get addDreamTitle => _isCzech ? 'Přidat sen' : 'Add Dream';
  String get dreamName => _isCzech ? 'Název snu' : 'Dream Name';
  String get positiveMotivationLabel =>
      _isCzech ? 'Pozitivní motivace' : 'Positive Motivation';
  String get negativeMotivationLabel =>
      _isCzech ? 'Negativní motivace' : 'Negative Motivation';
  String get noDreamsMessage =>
      _isCzech ? 'Zatím žádné sny.' : 'No dreams added yet.';
  String get addDreamButton => _isCzech ? 'Přidat sen' : 'Add Dream';
  String get selectImage => _isCzech ? 'Vybrat obrázek' : 'Select Image';

  // Goals
  String get goalsTitle => _isCzech ? 'Cíle' : 'Goals';
  String get addGoalTitle => _isCzech ? 'Přidat cíl' : 'Add Goal';
  String get goalName => _isCzech ? 'Název cíle' : 'Goal Name';
  String get selectDream => _isCzech ? 'Vybrat sen' : 'Select Dream';
  String get addGoalButton => _isCzech ? 'Přidat cíl' : 'Add Goal';
  String get noGoalsMessage =>
      _isCzech ? 'Zatím žádné cíle.' : 'No goals added yet.';
  String get relatedDreamLabel => _isCzech ? 'Propojený sen' : 'Related Dream';

  // Habits
  String get habitsTitle => _isCzech ? 'Návyky' : 'Habits';
  String get addHabitTitle => _isCzech ? 'Přidat návyk' : 'Add Habit';
  String get habitName => _isCzech ? 'Název návyku' : 'Habit Name';
  String get habitUnit => _isCzech ? 'Jednotka' : 'Unit';
  String get habitDailyTarget => _isCzech ? 'Denní cíl' : 'Daily Target';
  String get addHabitButton => _isCzech ? 'Přidat návyk' : 'Add Habit';
  String get noHabitsMessage =>
      _isCzech ? 'Zatím žádné návyky.' : 'No habits added yet.';
  String get dailyTargetLabel => _isCzech ? 'Denní cíl' : 'Daily Target';

  // Rewards
  String get rewardsTitle => _isCzech ? 'Odměny' : 'Rewards';
  String get addRewardTitle => _isCzech ? 'Přidat odměnu' : 'Add Reward';
  String get rewardName => _isCzech ? 'Název odměny' : 'Reward Name';
  String get rewardDescription => _isCzech ? 'Popis' : 'Description';
  String get addRewardButton => _isCzech ? 'Přidat odměnu' : 'Add Reward';
  String get noRewardsMessage =>
      _isCzech ? 'Zatím žádné odměny.' : 'No rewards added yet.';

  // Common
  String get progressLabel => _isCzech ? 'Pokrok' : 'Progress';
  String get cancel => _isCzech ? 'Zrušit' : 'Cancel';
  String get save => _isCzech ? 'Uložit' : 'Save';
  String get delete => _isCzech ? 'Smazat' : 'Delete';
  String get error => _isCzech ? 'Chyba' : 'Error';
  String get loading => _isCzech ? 'Načítání...' : 'Loading...';
}

class _SDelegate extends LocalizationsDelegate<S> {
  const _SDelegate();

  @override
  bool isSupported(Locale locale) =>
      ['en', 'cs'].contains(locale.languageCode);

  @override
  Future<S> load(Locale locale) async => S(locale);

  @override
  bool shouldReload(_SDelegate old) => false;
}
