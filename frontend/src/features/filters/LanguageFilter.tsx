import { useMemo } from "react";
import Form from "react-bootstrap/Form";

import { FilterSettings } from "@/common/schema_types";
import { StyledDropdownTreeSelect } from "@/common/StyledDropdownTreeSelect";
import { useGetLanguagesQuery } from "@/store/api";

interface LanguageFilterProps {
  filterSettings: FilterSettings;
  setFilterSettings: (value: FilterSettings) => void;
  allowedLanguages?: Array<string>;
}

export const LanguageFilter = ({
  filterSettings,
  setFilterSettings,
  allowedLanguages,
}: LanguageFilterProps) => {
  const getLanguagesQuery = useGetLanguagesQuery();
  const languageOptions = useMemo(() => {
    const allOptions = (getLanguagesQuery.data ?? []).map((row) => ({
      label: row.name,
      value: row.code,
      checked: filterSettings.languages.includes(row.code),
    }));
    if (allowedLanguages != null && allowedLanguages.length > 0) {
      const allowedSet = new Set(allowedLanguages);
      return allOptions.filter((opt) => allowedSet.has(opt.value));
    }
    return allOptions;
  }, [getLanguagesQuery.data, filterSettings.languages, allowedLanguages]);

  return (
    <>
      <Form.Label htmlFor="selectLanguage">Languages</Form.Label>
      <StyledDropdownTreeSelect
        data={languageOptions}
        onChange={(currentNode, selectedNodes) => {
          setFilterSettings({
            ...filterSettings,
            languages: selectedNodes.map((row) => row.value),
          });
        }}
        inlineSearchInput
      />
    </>
  );
};
