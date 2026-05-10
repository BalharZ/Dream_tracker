import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../main.dart';
import '../generated/S.dart';

class DreamsScreen extends StatefulWidget {
  const DreamsScreen({super.key});

  @override
  DreamsScreenState createState() => DreamsScreenState();
}

class DreamsScreenState extends State<DreamsScreen> {
  List<Map<String, dynamic>> _dreams = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadDreams();
  }

  Future<void> _loadDreams() async {
    setState(() => _isLoading = true);
    final data = await supabase
        .from('dreams')
        .select()
        .order('created_at', ascending: false);
    if (mounted) {
      setState(() {
        _dreams = List<Map<String, dynamic>>.from(data);
        _isLoading = false;
      });
    }
  }

  Future<String?> _uploadImage() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (picked == null) return null;

    final bytes = await picked.readAsBytes();
    final ext = picked.name.split('.').last;
    final path = '${supabase.auth.currentUser!.id}/${DateTime.now().millisecondsSinceEpoch}.$ext';

    await supabase.storage.from('images').uploadBinary(path, bytes);
    return supabase.storage.from('images').getPublicUrl(path);
  }

  void showAddDialog() {
    final nameCtrl = TextEditingController();
    final posCtrl = TextEditingController();
    final negCtrl = TextEditingController();
    String? imageUrl;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(builder: (ctx, setDialogState) {
          final s = S.of(context);
          return AlertDialog(
            title: Text(s.addDreamTitle),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(controller: nameCtrl, decoration: InputDecoration(labelText: s.dreamName)),
                  const SizedBox(height: 8),
                  TextField(controller: posCtrl, decoration: InputDecoration(labelText: s.positiveMotivationLabel)),
                  const SizedBox(height: 8),
                  TextField(controller: negCtrl, decoration: InputDecoration(labelText: s.negativeMotivationLabel)),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () async {
                      final url = await _uploadImage();
                      if (url != null) setDialogState(() => imageUrl = url);
                    },
                    icon: const Icon(Icons.image),
                    label: Text(s.selectImage),
                  ),
                  if (imageUrl != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Image.network(imageUrl!, height: 120, fit: BoxFit.cover),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: Text(s.cancel)),
              FilledButton(
                onPressed: () async {
                  if (nameCtrl.text.isEmpty) return;
                  await supabase.from('dreams').insert({
                    'user_id': supabase.auth.currentUser!.id,
                    'name': nameCtrl.text,
                    'positive_motivation': posCtrl.text,
                    'negative_motivation': negCtrl.text,
                    'image_url': imageUrl,
                  });
                  if (ctx.mounted) Navigator.pop(ctx);
                  _loadDreams();
                },
                child: Text(s.addDreamButton),
              ),
            ],
          );
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);

    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_dreams.isEmpty) return Center(child: Text(s.noDreamsMessage));

    return RefreshIndicator(
      onRefresh: _loadDreams,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _dreams.length,
        itemBuilder: (context, index) {
          final dream = _dreams[index];
          return Card(
            clipBehavior: Clip.antiAlias,
            child: ListTile(
              leading: dream['image_url'] != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(dream['image_url'], width: 50, height: 50, fit: BoxFit.cover),
                    )
                  : const Icon(Icons.nightlight_round, size: 40),
              title: Text(dream['name']),
              subtitle: dream['positive_motivation'] != null
                  ? Text(dream['positive_motivation'], maxLines: 1, overflow: TextOverflow.ellipsis)
                  : null,
              trailing: IconButton(
                icon: const Icon(Icons.delete_outline),
                onPressed: () async {
                  await supabase.from('dreams').delete().eq('id', dream['id']);
                  _loadDreams();
                },
              ),
            ),
          );
        },
      ),
    );
  }
}
