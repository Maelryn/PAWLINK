import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';

import '../../core/map/algeria.dart';
import '../../core/map/user_location.dart';
import '../adopt/data/adoption_models.dart' show Species, UserLite;
import '../cases/data/case_models.dart';
import '../cases/providers.dart';
import '../map/presentation/case_format.dart' show speciesLabel;
import '../services/providers.dart' show currentUserIdProvider;
import 'data/report_case_builder.dart';
import 'data/report_models.dart';
import 'data/report_trust.dart';
import 'data/triage_rules.dart';

/// How the flow reads the phone's position. A provider so tests can replace
/// the platform call.
final devicePositionProvider = Provider<Future<LatLng?> Function()>(
  (ref) => resolveUserLocation,
);

/// Number of steps of the form: photo, place, animal, situation.
const int reportStepCount = 4;

enum ReportPhase { form, ask, result }

/// What the reporter sees at the end: the triage and the case it created.
class ReportResult {
  const ReportResult({required this.analysis, required this.created});

  final AIAnalysis analysis;
  final Case created;
}

const _keep = Object();

class ReportState {
  const ReportState({
    this.draft = const ReportDraft(),
    this.step = 0,
    this.phase = ReportPhase.form,
    this.location = LocationStatus.idle,
    this.photoError,
    this.submitError,
    this.submitting = false,
    this.questions = const [],
    this.questionIndex = 0,
    this.answers = const {},
    this.result,
  });

  final ReportDraft draft;
  final int step;
  final ReportPhase phase;
  final LocationStatus location;
  final String? photoError;
  final String? submitError;
  final bool submitting;

  /// The quick questions the triage asked, and how far the reporter is.
  final List<FollowUpId> questions;
  final int questionIndex;
  final Map<FollowUpId, bool> answers;
  final ReportResult? result;

  /// Whether the step on screen is complete enough to go on.
  bool get canContinue => switch (step) {
    0 => true, // the photo is optional
    1 => draft.position != null,
    2 => draft.species != null,
    _ => draft.hasEnoughSituation,
  };

  bool get isLastStep => step == reportStepCount - 1;

  ReportState copyWith({
    ReportDraft? draft,
    int? step,
    ReportPhase? phase,
    LocationStatus? location,
    Object? photoError = _keep,
    Object? submitError = _keep,
    bool? submitting,
    List<FollowUpId>? questions,
    int? questionIndex,
    Map<FollowUpId, bool>? answers,
    ReportResult? result,
  }) => ReportState(
    draft: draft ?? this.draft,
    step: step ?? this.step,
    phase: phase ?? this.phase,
    location: location ?? this.location,
    photoError:
        identical(photoError, _keep) ? this.photoError : photoError as String?,
    submitError:
        identical(submitError, _keep)
            ? this.submitError
            : submitError as String?,
    submitting: submitting ?? this.submitting,
    questions: questions ?? this.questions,
    questionIndex: questionIndex ?? this.questionIndex,
    answers: answers ?? this.answers,
    result: result ?? this.result,
  );
}

/// The Signaler flow: the form, the triage, the quick questions and the
/// publication. Autodisposed, so closing the flow forgets the draft.
class ReportController extends Notifier<ReportState> {
  final _picker = ImagePicker();

  @override
  ReportState build() {
    // Keeps the cases list loaded and current while the flow is open: the
    // hourly limit reads it, and a case published here must reach the map.
    ref.listen(casesProvider, (previous, next) {});
    return const ReportState();
  }

  ReportDraft get _draft => state.draft;

  // Steps

  void next() {
    if (!state.canContinue || state.isLastStep) return;
    state = state.copyWith(step: state.step + 1, submitError: null);
  }

  void back() {
    if (state.step == 0) return;
    state = state.copyWith(step: state.step - 1, submitError: null);
  }

  void goToStep(int step) {
    if (step >= 0 && step < state.step) state = state.copyWith(step: step);
  }

  // Photo

  Future<void> pickPhoto(ImageSource source) async {
    try {
      final file = await _picker.pickImage(
        source: source,
        maxWidth: 1600,
        imageQuality: 85,
      );
      if (!ref.mounted || file == null) return;
      state = state.copyWith(
        draft: _draft.copyWith(photoPath: file.path),
        photoError: null,
      );
    } catch (_) {
      if (!ref.mounted) return;
      state = state.copyWith(
        photoError:
            source == ImageSource.camera
                ? "Impossible d'ouvrir l'appareil photo. Vérifiez l'autorisation "
                    'de la caméra.'
                : "Impossible d'ouvrir la galerie.",
      );
    }
  }

  void removePhoto() =>
      state = state.copyWith(draft: _draft.copyWith(clearPhoto: true));

  // Position

  /// Asks for the device position. It must be inside Algeria.
  Future<void> locate() async {
    state = state.copyWith(location: LocationStatus.locating);
    final here = await ref.read(devicePositionProvider)();
    if (!ref.mounted) return;
    if (here == null) {
      state = state.copyWith(location: LocationStatus.denied);
    } else if (!Algeria.contains(here)) {
      state = state.copyWith(location: LocationStatus.outside);
    } else {
      state = state.copyWith(
        location: LocationStatus.found,
        draft: _draft.copyWith(position: _positionOf(here)),
      );
    }
  }

  /// For testers without location. The report will say "not on site".
  void useDemoPosition() =>
      state = state.copyWith(
        location: LocationStatus.found,
        draft: _draft.copyWith(
          position: _positionOf(Algeria.demoPosition, true),
        ),
      );

  ReportPosition _positionOf(LatLng p, [bool isDemo = false]) =>
      ReportPosition(lat: p.latitude, lng: p.longitude, isDemo: isDemo);

  void setAddress(String value) =>
      state = state.copyWith(draft: _draft.copyWith(address: value));

  // Animal and situation

  void setSpecies(Species species) =>
      state = state.copyWith(draft: _draft.copyWith(species: species));

  void setCount(int count) {
    if (count < 1 || count > 99) return;
    state = state.copyWith(draft: _draft.copyWith(count: count));
  }

  void toggleTag(String id) {
    final tags = [..._draft.tags];
    tags.contains(id) ? tags.remove(id) : tags.add(id);
    state = state.copyWith(draft: _draft.copyWith(tags: tags));
  }

  void setDescription(String value) =>
      state = state.copyWith(draft: _draft.copyWith(description: value));

  // Submit

  TriageInput _triageInput([Map<FollowUpId, bool> answers = const {}]) =>
      TriageInput(
        species: _draft.species!,
        speciesName: speciesLabel(_draft.species!),
        count: _draft.count,
        description: _draft.description,
        conditionTags: _draft.tags,
        answers: answers,
      );

  /// Runs the safety rules. If they want to ask something first, the quick
  /// questions come next; otherwise the case is published.
  Future<void> submit() async {
    final position = _draft.position;
    if (state.submitting || position == null || _draft.species == null) return;

    if (!Algeria.contains(LatLng(position.lat, position.lng))) {
      state = state.copyWith(
        submitError: "Ce lieu est en dehors de l'Algérie.",
      );
      return;
    }
    if (_recentReports() >= maxReportsPerHour) {
      state = state.copyWith(
        submitError:
            'Trop de signalements dans la dernière heure. Réessayez plus '
            'tard.',
      );
      return;
    }

    final analysis = analyzeReport(_triageInput());
    final questions = analysis.followUps;
    if (questions != null && questions.isNotEmpty) {
      state = state.copyWith(
        phase: ReportPhase.ask,
        questions: questions,
        questionIndex: 0,
        answers: const {},
        submitError: null,
      );
      return;
    }
    await _publish(analysis, const {});
  }

  /// One answer, or null for "je ne sais pas". After the last question the
  /// triage runs again with the answers.
  Future<void> answer(bool? value) async {
    if (state.submitting || state.phase != ReportPhase.ask) return;
    final question = state.questions[state.questionIndex];
    final answers =
        value == null ? state.answers : {...state.answers, question: value};
    if (state.questionIndex < state.questions.length - 1) {
      state = state.copyWith(
        questionIndex: state.questionIndex + 1,
        answers: answers,
      );
      return;
    }
    state = state.copyWith(answers: answers);
    await _publish(analyzeReport(_triageInput(answers)), answers);
  }

  Future<void> _publish(
    AIAnalysis analysis,
    Map<FollowUpId, bool> answers,
  ) async {
    state = state.copyWith(submitting: true, submitError: null);
    final position = _draft.position!;
    final now = DateTime.now();
    final trust = computeReportTrust(
      position: position,
      inAlgeria: Algeria.contains(LatLng(position.lat, position.lng)),
      recentReports: _recentReports(),
    );
    final newCase = buildReportCase(
      draft: _draft,
      speciesName: speciesLabel(_draft.species!),
      reporter: UserLite(id: ref.read(currentUserIdProvider), name: 'Moi'),
      analysis: analysis,
      trust: trust,
      answers: answers,
      now: now,
    );
    try {
      await ref.read(caseActionsProvider).addCase(newCase);
      if (!ref.mounted) return;
      state = state.copyWith(
        phase: ReportPhase.result,
        submitting: false,
        result: ReportResult(analysis: analysis, created: newCase),
      );
    } catch (_) {
      if (!ref.mounted) return;
      state = state.copyWith(
        phase: ReportPhase.form,
        submitting: false,
        submitError: "Impossible d'envoyer le signalement. Réessayez.",
      );
    }
  }

  /// Reports this person sent in the last hour (web: `recentReportsBy`).
  int _recentReports() {
    final userId = ref.read(currentUserIdProvider);
    final since = DateTime.now().subtract(const Duration(hours: 1));
    final all = ref.read(casesProvider).value ?? const <Case>[];
    return all
        .where((c) => c.reporter.id == userId && c.createdAt.isAfter(since))
        .length;
  }

  /// Opens the Carte tab on the new case.
  void showOnMap() {
    final created = state.result?.created;
    if (created != null) ref.read(caseActionsProvider).showOnMap(created.id);
  }

  /// "Nouveau signalement".
  void startOver() => state = const ReportState();
}

final reportControllerProvider =
    NotifierProvider.autoDispose<ReportController, ReportState>(
      ReportController.new,
    );
