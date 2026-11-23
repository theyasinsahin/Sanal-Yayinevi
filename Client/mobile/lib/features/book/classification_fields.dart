import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../core/api/documents.dart';
import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';
import '../discovery/feed_screen.dart';

/// Same character set and length as the server's tag rule.
final RegExp tagPattern = RegExp(r"^[\p{L}\p{N}\p{M} '#+.\-]+$", unicode: true);

/// Editable classification (F-WRITE-02). Limits mirror
/// `Server/src/services/classificationService.js`: one format, 1–3 genres,
/// at most 8 tags of 2–50 characters, optional features, audience and
/// content warnings.
class ClassificationValue {
  ClassificationValue({
    this.formatId,
    Set<String>? genreIds,
    List<String>? tags,
    Set<String>? featureIds,
    this.audienceId,
    Set<String>? warningIds,
  }) : genreIds = genreIds ?? {},
       tags = tags ?? [],
       featureIds = featureIds ?? {},
       warningIds = warningIds ?? {};

  String? formatId;
  final Set<String> genreIds;
  final List<String> tags;
  final Set<String> featureIds;
  String? audienceId;
  final Set<String> warningIds;

  factory ClassificationValue.fromClassification(Classification c) => ClassificationValue(
    formatId: c.format?.id,
    genreIds: c.genres.map((term) => term.id).toSet(),
    tags: c.tags.map((term) => term.name).toList(),
    featureIds: c.features.map((term) => term.id).toSet(),
    audienceId: c.audience?.id,
    warningIds: c.warnings.map((term) => term.id).toSet(),
  );

  /// Validation messages in display order; empty when valid.
  List<String> validate() => [
    if (formatId == null) 'Bir eser biçimi seçin.',
    if (genreIds.isEmpty || genreIds.length > 3) 'En az 1, en fazla 3 tür/konu seçin.',
    if (tags.length > 8) 'En fazla 8 etiket ekleyebilirsiniz.',
  ];

  /// Null when [tag] can be added, otherwise the reason.
  String? tagProblem(String tag) {
    final value = tag.trim();
    if (value.length < 2 || value.length > 50) return 'Etiket 2–50 karakter olmalıdır.';
    if (!tagPattern.hasMatch(value)) return 'Etiket yalnızca harf, rakam, boşluk ve \' # + . - içerebilir.';
    if (tags.length >= 8) return 'En fazla 8 etiket ekleyebilirsiniz.';
    final folded = trLower(value).replaceAll(RegExp(r'\s+'), ' ');
    if (tags.any((existing) => trLower(existing).replaceAll(RegExp(r'\s+'), ' ') == folded)) {
      return 'Bu etiket zaten eklendi.';
    }
    return null;
  }

  /// `ClassificationInput`.
  Json toInput() => {
    'formatId': formatId,
    'genreIds': genreIds.toList(),
    'tags': tags,
    'narrativeFeatureIds': featureIds.toList(),
    'targetAudienceId': audienceId,
    'contentWarningIds': warningIds.toList(),
  };
}

class ClassificationFields extends StatefulWidget {
  const ClassificationFields({super.key, required this.value, required this.options, required this.onChanged, this.current});
  final ClassificationValue value;
  final ClassificationOptions options;
  final VoidCallback onChanged;

  /// The stored classification, to show terms that were deactivated since.
  final Classification? current;

  @override
  State<ClassificationFields> createState() => _ClassificationFieldsState();
}

class _ClassificationFieldsState extends State<ClassificationFields> {
  final _tag = TextEditingController();
  final _genreSearch = TextEditingController();
  Timer? _debounce;
  List<Term> _suggestions = const [];
  String? _tagError;

  @override
  void dispose() {
    _debounce?.cancel();
    _tag.dispose();
    _genreSearch.dispose();
    super.dispose();
  }

  void _changed() {
    setState(() {});
    widget.onChanged();
  }

  void _addTag([String? text]) {
    final tag = (text ?? _tag.text).trim();
    if (tag.isEmpty) return;
    final problem = widget.value.tagProblem(tag);
    if (problem != null) {
      setState(() => _tagError = problem);
      return;
    }
    widget.value.tags.add(tag);
    _tag.clear();
    _suggestions = const [];
    _tagError = null;
    _changed();
  }

  void _searchTags(String text) {
    _debounce?.cancel();
    if (text.trim().length < 2) {
      setState(() => _suggestions = const []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 250), () async {
      try {
        final data = await context.services.api.run(
          r'query SearchClassificationTags($search: String) { searchClassificationTags(search: $search) { id slug name isActive } }',
          variables: {'search': text.trim()},
        );
        if (mounted) setState(() => _suggestions = jsonList(data['searchClassificationTags']).map(Term.fromJson).toList());
      } on ApiException {
        // Suggestions are optional; typing a new tag still works.
      }
    });
  }

  /// Options plus any stored term that is no longer active.
  List<(Term, bool)> _withInactive(List<Term> options, Iterable<Term> stored) {
    final ids = options.map((term) => term.id).toSet();
    return [
      for (final term in options) (term, true),
      for (final term in stored)
        if (!ids.contains(term.id)) (term, false),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final value = widget.value;
    final options = widget.options;
    final current = widget.current;
    final formats = _withInactive(options.formats, [if (current?.format != null) current!.format!]);
    final query = trFold(_genreSearch.text.trim());
    final genres = options.genres.where((genre) => query.isEmpty || trFold(genre.name).contains(query)).toList();

    Widget multi(String title, List<Term> terms, Set<String> selected) => LabeledField(
      label: title,
      child: Wrap(
        spacing: 6,
        runSpacing: 2,
        children: [
          for (final term in terms)
            FilterChip(
              label: Text(term.name),
              selected: selected.contains(term.id),
              onSelected: (on) {
                on ? selected.add(term.id) : selected.remove(term.id);
                _changed();
              },
            ),
        ],
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LabeledField(
          label: 'Eser biçimi',
          required: true,
          child: DropdownButtonFormField<String?>(
            initialValue: formats.any((entry) => entry.$1.id == value.formatId) ? value.formatId : null,
            isExpanded: true,
            hint: const Text('Seçin'),
            items: [
              for (final (term, active) in formats)
                DropdownMenuItem<String?>(
                  value: term.id,
                  child: Text(active ? term.name : '${term.name} (pasif; kaldırın / yeniden seçin)', overflow: TextOverflow.ellipsis),
                ),
            ],
            onChanged: (id) {
              value.formatId = id;
              _changed();
            },
          ),
        ),
        LabeledField(
          label: 'Tür ve konular',
          required: true,
          hint: 'En az 1, en fazla 3 tür/konu seçin. (${value.genreIds.length}/3)',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _genreSearch,
                decoration: const InputDecoration(hintText: 'Tür ara...', prefixIcon: Icon(Icons.search, size: 20)),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 6),
              GenreChoices(genres: genres, selected: value.genreIds, onChanged: _changed, max: 3),
            ],
          ),
        ),
        LabeledField(
          label: 'Etiketler',
          hint: 'En fazla 8 etiket; 2–50 karakter. (${value.tags.length}/8)',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (value.tags.isNotEmpty)
                Wrap(
                  spacing: 6,
                  children: [
                    for (final tag in value.tags)
                      InputChip(
                        label: Text('#$tag'),
                        onDeleted: () {
                          value.tags.remove(tag);
                          _changed();
                        },
                      ),
                  ],
                ),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _tag,
                      maxLength: 50,
                      decoration: InputDecoration(hintText: 'Etiket yazın', counterText: '', errorText: _tagError),
                      onChanged: _searchTags,
                      onSubmitted: (_) => _addTag(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(onPressed: _addTag, child: const Text('EKLE')),
                ],
              ),
              if (_suggestions.isNotEmpty)
                Wrap(
                  spacing: 6,
                  children: [
                    for (final suggestion in _suggestions)
                      ActionChip(label: Text('#${suggestion.name}'), onPressed: () => _addTag(suggestion.name)),
                  ],
                ),
            ],
          ),
        ),
        if (options.features.isNotEmpty) multi('Anlatım özellikleri', options.features, value.featureIds),
        if (options.audiences.isNotEmpty)
          LabeledField(
            label: 'Hedef okur kitlesi',
            child: DropdownButtonFormField<String?>(
              initialValue: options.audiences.any((term) => term.id == value.audienceId) ? value.audienceId : null,
              isExpanded: true,
              items: [
                const DropdownMenuItem<String?>(value: null, child: Text('Belirtilmedi')),
                for (final term in options.audiences) DropdownMenuItem<String?>(value: term.id, child: Text(term.name)),
              ],
              onChanged: (id) {
                value.audienceId = id;
                _changed();
              },
            ),
          ),
        if (options.warnings.isNotEmpty) multi('İçerik uyarıları', options.warnings, value.warningIds),
      ],
    );
  }
}

/// "Eser hakkında" block with "Belirtilmedi" placeholders.
class ClassificationSummary extends StatelessWidget {
  const ClassificationSummary(this.classification, {super.key});
  final Classification classification;

  @override
  Widget build(BuildContext context) {
    Widget row(String title, List<String> values) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(title, style: sans(size: 13, color: BetikColors.ashGray)),
          ),
          Expanded(
            child: values.isEmpty
                ? Text(
                    'Belirtilmedi',
                    style: serif(size: 13, style: FontStyle.italic, color: BetikColors.silverGray),
                  )
                : Wrap(spacing: 6, runSpacing: 6, children: [for (final value in values) TagChip(value)]),
          ),
        ],
      ),
    );
    final c = classification;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        row('Eser biçimi', [if (c.format != null) c.format!.name]),
        row('Tür ve konular', c.genres.map((term) => term.name).toList()),
        row('Etiketler', c.tags.map((term) => '#${term.name}').toList()),
        row('Anlatım', c.features.map((term) => term.name).toList()),
        row('Hedef okur', [if (c.audience != null) c.audience!.name]),
        row('İçerik uyarıları', c.warnings.map((term) => term.name).toList()),
      ],
    );
  }
}

/// Inline classification editor for author / admin / submitter (F-BOOK-09).
class ClassificationEditor extends StatefulWidget {
  const ClassificationEditor({super.key, required this.book, required this.onSaved});
  final Book book;
  final VoidCallback onSaved;

  @override
  State<ClassificationEditor> createState() => _ClassificationEditorState();
}

class _ClassificationEditorState extends State<ClassificationEditor> {
  ClassificationValue? _value;
  List<String> _errors = const [];

  Future<void> _save() async {
    final value = _value!;
    final errors = value.validate();
    setState(() => _errors = errors);
    if (errors.isNotEmpty) return;
    try {
      await context.services.api.run(
        'mutation UpdateBookClassification(\$bookId: ID!, \$classification: ClassificationInput!) { updateBookClassification(bookId: \$bookId, classification: \$classification) { id $classificationFields } }',
        variables: {'bookId': widget.book.id, 'classification': value.toInput()},
      );
      if (!mounted) return;
      setState(() => _value = null);
      showToast(context, 'Sınıflandırma kaydedildi.', type: ToastType.success);
      widget.onSaved();
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_value == null) {
      return OutlinedButton.icon(
        onPressed: () => setState(() => _value = ClassificationValue.fromClassification(widget.book.classification)),
        icon: const Icon(Icons.category_outlined, size: 18),
        label: const Text('SINIFLANDIRMAYI DÜZENLE'),
      );
    }
    return PaperCard(
      child: Loader<ClassificationOptions>(
        load: () => loadClassificationOptions(context.services.api),
        builder: (context, options, _) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClassificationFields(value: _value!, options: options, current: widget.book.classification, onChanged: () => setState(() {})),
            for (final error in _errors) Text(error, style: sans(size: 13, color: BetikColors.danger)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: BusyButton(onPressed: _save, label: 'Sınıflandırmayı kaydet'),
                ),
                const SizedBox(width: 8),
                TextButton(onPressed: () => setState(() => _value = null), child: const Text('İptal')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
