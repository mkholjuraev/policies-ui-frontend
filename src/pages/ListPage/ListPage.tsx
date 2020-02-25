import * as React from 'react';
import { useContext } from 'react';
import { IActions, IRowData } from '@patternfly/react-table';
import { Main, PageHeader, PageHeaderTitle, Section } from '@redhat-cloud-services/frontend-components';

import { PolicyRow, PolicyTable } from '../../components/Policy/Table/PolicyTable';
import { useGetPoliciesQuery } from '../../services/Api';
import { PolicyToolbar, SelectionCommand } from '../../components/Policy/TableToolbar/PolicyTableToolbar';
import { CreatePolicyWizard } from './CreatePolicyWizard';
import { RbacContext } from '../../components/RbacContext';
import { policyTableError } from './PolicyTableError';
import { Policy } from '../../types/Policy';
import { DeletePolicy } from './DeletePolicy';
import { SavingMode } from '../../components/Policy/PolicyWizard';
import { PolicyWithOptionalId } from '../../types/Policy/Policy';
import { assertNever } from '../../utils/Assert';
import { usePolicyFilter } from '../../hooks/usePolicyFilter';
import { usePolicyPage } from '../../hooks/usePolicyPage';
import { useSort } from '../../hooks/useSort';

type ListPageProps = {};

type PolicyWizardStateBase = {
    template: PolicyWithOptionalId | undefined;
    savingMode: SavingMode;
};

type PolicyWizardStateOpen = {
    isOpen: true;
} & PolicyWizardStateBase;

type PolicyWizardStateClosed = {
    isOpen: false;
} & Partial<PolicyWizardStateBase>;

type PolicyWizardState = PolicyWizardStateClosed | PolicyWizardStateOpen;

const ListPage: React.FunctionComponent<ListPageProps> = (_props) => {

    const [ policyWizardState, setPolicyWizardState ] = React.useState<PolicyWizardState>({
        isOpen: false
    });
    const [ policyToDelete, setPolicyToDelete ] = React.useState<Policy[] | undefined>(undefined);
    const policyFilters = usePolicyFilter();
    const sort = useSort();
    const policyPage = usePolicyPage(policyFilters.debouncedFilters, sort.sortBy);
    const getPoliciesQuery = useGetPoliciesQuery(policyPage.page, false);
    const { canReadAll, canWriteAll } = useContext(RbacContext);

    const { query: getPoliciesQueryReload } = getPoliciesQuery;

    const onCloseDeletePolicy = React.useCallback((deleted: boolean) => {
        if (deleted) {
            getPoliciesQueryReload();
        }

        setPolicyToDelete(undefined);
    }, [ getPoliciesQueryReload, setPolicyToDelete ]);

    const getPolicyFromPayload =  React.useCallback(
        (id: number) => getPoliciesQuery.payload?.find(policy => policy.id === id),
        [ getPoliciesQuery.payload ]);

    const tableActions: IActions = React.useMemo<IActions>(() => {
        if (!canWriteAll) {
            return [];
        }

        return [
            {
                title: 'Edit',
                onClick: (_event: React.MouseEvent, _rowIndex: number, rowData: IRowData) => {
                    const policy = getPolicyFromPayload(rowData.id);
                    if (policy) {
                        setPolicyWizardState({
                            isOpen: true,
                            template: policy,
                            savingMode: SavingMode.UPDATE
                        });
                    }
                }
            },
            {
                title: 'Duplicate',
                onClick: () => alert('Duplicate')
            },
            {
                title: 'Delete',
                onClick: (_event: React.MouseEvent, _rowIndex: number, rowData: IRowData) => {
                    const policy = getPolicyFromPayload(rowData.id);
                    if (policy) {
                        setPolicyToDelete([ policy ]);
                    }
                }
            }
        ];
    }, [ canWriteAll, setPolicyToDelete, getPolicyFromPayload ]);

    React.useEffect(() => {
        if (canReadAll) {
            getPoliciesQueryReload();
        }
    }, [ canReadAll, getPoliciesQueryReload ]);

    const createCustomPolicy = React.useCallback(() => {
        setPolicyWizardState({
            isOpen: true,
            savingMode: SavingMode.CREATE,
            template: undefined
        });
    }, [ setPolicyWizardState ]);

    const closeCustomPolicyWizard = React.useCallback((policyCreated: boolean) => {
        if (policyCreated) {
            getPoliciesQueryReload();
        }

        setPolicyWizardState({
            isOpen: false
        });
    }, [ setPolicyWizardState, getPoliciesQueryReload ]);

    const policyTableErrorValue = React.useMemo(
        () => policyTableError(canReadAll, getPoliciesQuery.error, getPoliciesQuery.status),
        [ canReadAll, getPoliciesQuery.error, getPoliciesQuery.status ]
    );

    const [ policyRows, setPolicyRows ] = React.useState<PolicyRow[]>([]);

    React.useEffect(() => {
        if (getPoliciesQuery.payload) {
            setPolicyRows(getPoliciesQuery.payload?.map(policy => ({ ...policy, isOpen: false, isSelected: false })));
        }
    }, [ getPoliciesQuery.payload ]);

    const onCollapse = React.useCallback((policy: PolicyRow, index: number, isOpen: boolean) => {
        setPolicyRows(prevRows => {
            const newPolicyRows = [ ...prevRows ];
            newPolicyRows[index] = { ...policy, isOpen };
            return newPolicyRows;
        });
    }, [ setPolicyRows ]);

    const onSelect = React.useCallback((policy: PolicyRow, index: number, isSelected: boolean) => {
        setPolicyRows(prevRows => {
            const newPolicyRows = [ ...prevRows ];
            newPolicyRows[index] = { ...policy, isSelected };
            return newPolicyRows;
        });
    }, [ setPolicyRows ]);

    const onSelectionChanged = React.useCallback((command: SelectionCommand) => {
        if (command === SelectionCommand.NONE) {
            setPolicyRows(prevState => prevState.map(policy => ({ ...policy, isSelected: false })));
        } else if (command === SelectionCommand.PAGE) {
            setPolicyRows(prevState => prevState.map(policy => ({ ...policy, isSelected: true })));
        } else {
            assertNever(command);
        }
    }, [ setPolicyRows ]);

    const selectedCount = React.useMemo(() => policyRows.filter(policy => policy.isSelected).length, [ policyRows ]);

    const onDeletePolicies = React.useCallback(
        () => setPolicyToDelete(policyRows.filter(policy => policy.isSelected)),
        [ policyRows, setPolicyToDelete ]
    );

    return (
        <>
            <PageHeader>
                <PageHeaderTitle title="Custom policies"/>
            </PageHeader>
            <Main>
                <Section>
                    <PolicyToolbar
                        onCreatePolicy={ canWriteAll ? createCustomPolicy : undefined }
                        onDeletePolicy={ canWriteAll ? onDeletePolicies : undefined }
                        onPaginationChanged={ policyPage.changePage }
                        onPaginationSizeChanged={ policyPage.changeItemsPerPage }
                        onSelectionChanged={ onSelectionChanged }
                        selectedCount={ selectedCount }
                        page={ policyPage.currentPage }
                        pageCount={ getPoliciesQuery.payload?.length }
                        perPage={ policyPage.itemsPerPage }
                        filterElements={ policyFilters.filters }
                        setFilterElements = { policyFilters.setFilters }
                        clearFilters={ policyFilters.clearFilterHandler }
                        count={ getPoliciesQuery.count }
                    />
                    <PolicyTable
                        policies={ policyRows }
                        onCollapse={ onCollapse }
                        onSelect={ onSelect }
                        actions={ tableActions }
                        loading={ getPoliciesQuery.loading }
                        error={ policyTableErrorValue }
                        onSort={ sort.onSort }
                        sortBy={ sort.sortBy }
                    />
                </Section>
            </Main>
            { policyWizardState.isOpen && <CreatePolicyWizard
                isOpen={ policyWizardState.isOpen }
                close={ closeCustomPolicyWizard }
                initialValue={ policyWizardState.template }
                savingMode={ policyWizardState.savingMode }
            /> }
            <DeletePolicy onClose={ onCloseDeletePolicy } policies={ policyToDelete }/>
        </>
    );
};

export default ListPage;
