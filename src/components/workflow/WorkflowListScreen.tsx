import type { ReactElement } from "react";
import {
  FlatList,
  StyleSheet,
  View,
  type ListRenderItem,
} from "react-native";

import { floorTemplateFlow } from "../../utils/workflowFlows";
import type { WorkflowFlowStep } from "../../utils/workflowFlows";
import { spacing } from "../../theme/tokens";
import { StepIndicator } from "./StepIndicator";
import type { WorkflowStep } from "./types";
import { WorkflowScreen } from "./WorkflowScreen";

type WorkflowListScreenProps<ItemT> = {
  title: string;
  subtitle: string;
  headerActionLabel?: string;
  onHeaderActionPress?: () => void;
  activeStep: WorkflowStep;
  flow?: WorkflowFlowStep[];
  primaryLabel: string;
  onPrimaryPress: () => void;
  primaryDisabled?: boolean;
  actionErrorText?: string;
  data: ItemT[];
  keyExtractor: (item: ItemT, index: number) => string;
  renderItem: ListRenderItem<ItemT>;
  listHeader?: ReactElement;
  listFooter?: ReactElement;
  ListEmptyComponent?: ReactElement;
};

export function WorkflowListScreen<ItemT>({
  title,
  subtitle,
  headerActionLabel,
  onHeaderActionPress,
  activeStep,
  flow = floorTemplateFlow,
  primaryLabel,
  onPrimaryPress,
  primaryDisabled,
  actionErrorText,
  data,
  keyExtractor,
  renderItem,
  listHeader,
  listFooter,
  ListEmptyComponent,
}: WorkflowListScreenProps<ItemT>) {
  return (
    <WorkflowScreen
      activeStep={activeStep}
      actionErrorText={actionErrorText}
      flow={flow}
      headerActionLabel={headerActionLabel}
      managesOwnScrolling
      onHeaderActionPress={onHeaderActionPress}
      onPrimaryPress={onPrimaryPress}
      primaryDisabled={primaryDisabled}
      primaryLabel={primaryLabel}
      subtitle={subtitle}
      title={title}
    >
      <FlatList
        contentContainerStyle={styles.listContent}
        data={data}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <StepIndicator activeStep={activeStep} flow={flow} />
            {listHeader}
          </View>
        }
        ListFooterComponent={listFooter}
        ListEmptyComponent={ListEmptyComponent}
        renderItem={renderItem}
      />
    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    gap: spacing.md,
    padding: spacing.xl,
    paddingBottom: spacing.xl,
  },
  listHeader: {
    gap: spacing.cardGap,
  },
});
