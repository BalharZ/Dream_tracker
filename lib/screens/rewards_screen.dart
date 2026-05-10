import 'package:flutter/material.dart';
import '../main.dart';
import '../generated/S.dart';

class RewardsScreen extends StatefulWidget {
  const RewardsScreen({super.key});

  @override
  RewardsScreenState createState() => RewardsScreenState();
}

class RewardsScreenState extends State<RewardsScreen> {
  List<Map<String, dynamic>> _rewards = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadRewards();
  }

  Future<void> _loadRewards() async {
    setState(() => _isLoading = true);
    final data = await supabase
        .from('rewards')
        .select()
        .order('created_at', ascending: false);
    setState(() {
      _rewards = List<Map<String, dynamic>>.from(data);
      _isLoading = false;
    });
  }

  void showAddDialog() {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) {
        final s = S.of(context);
        return AlertDialog(
          title: Text(s.addRewardTitle),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameCtrl,
                  decoration: InputDecoration(labelText: s.rewardName),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: descCtrl,
                  decoration: InputDecoration(labelText: s.rewardDescription),
                  maxLines: 3,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(s.cancel),
            ),
            FilledButton(
              onPressed: () async {
                if (nameCtrl.text.isEmpty) return;
                await supabase.from('rewards').insert({
                  'user_id': supabase.auth.currentUser!.id,
                  'name': nameCtrl.text,
                  'description': descCtrl.text,
                });
                if (ctx.mounted) Navigator.pop(ctx);
                _loadRewards();
              },
              child: Text(s.addRewardButton),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_rewards.isEmpty) {
      return Center(child: Text(s.noRewardsMessage));
    }

    return RefreshIndicator(
      onRefresh: _loadRewards,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _rewards.length,
        itemBuilder: (context, index) {
          final reward = _rewards[index];
          return Card(
            child: ListTile(
              leading: const Icon(Icons.card_giftcard, size: 40),
              title: Text(reward['name']),
              subtitle: reward['description'] != null && reward['description'].isNotEmpty
                  ? Text(reward['description'])
                  : null,
              trailing: IconButton(
                icon: const Icon(Icons.delete_outline),
                onPressed: () async {
                  await supabase.from('rewards').delete().eq('id', reward['id']);
                  _loadRewards();
                },
              ),
            ),
          );
        },
      ),
    );
  }
}
