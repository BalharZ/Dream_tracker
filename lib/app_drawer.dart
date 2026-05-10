import 'package:flutter/material.dart';
import 'generated/S.dart';
import 'main.dart';
import 'screens/login_screen.dart';

class AppDrawer extends StatelessWidget {
  final Function(Locale) onChangeLanguage;

  const AppDrawer({Key? key, required this.onChangeLanguage}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final user = supabase.auth.currentUser;

    return Drawer(
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          DrawerHeader(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primaryContainer,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Icon(
                  Icons.nightlight_round,
                  size: 48,
                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                ),
                const SizedBox(height: 8),
                Text(
                  s.appName,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                  ),
                ),
                if (user?.email != null)
                  Text(
                    user!.email!,
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.onPrimaryContainer.withOpacity(0.7),
                    ),
                  ),
              ],
            ),
          ),
          ListTile(
            leading: const Icon(Icons.language),
            title: const Text('Čeština / English'),
            onTap: () {
              final current = Localizations.localeOf(context);
              final next = current.languageCode == 'cs'
                  ? const Locale('en')
                  : const Locale('cs');
              onChangeLanguage(next);
              Navigator.pop(context);
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.exit_to_app),
            title: Text(s.logout),
            onTap: () async {
              await supabase.auth.signOut();
              if (context.mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(
                    builder: (_) => LoginScreen(onChangeLanguage: onChangeLanguage),
                  ),
                  (_) => false,
                );
              }
            },
          ),
        ],
      ),
    );
  }
}
