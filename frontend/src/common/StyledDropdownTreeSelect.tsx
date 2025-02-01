import DropdownTreeSelect from "react-dropdown-tree-select";
import styled from "styled-components";

export const StyledDropdownTreeSelect = styled(DropdownTreeSelect)`
  .tag {
    color: black;
    background-color: #dddddd;
  }
  .tag-remove {
    color: #666666;
  }

  .dropdown-trigger {
    border-radius: 0.25rem;
    background-color: white;
  }
  .dropdown-content {
    border-radius: 0.25rem;
  }

  .search {
    background-color: white;
    color: black;
  }
  .search::placeholder {
    color: black;
  }

  .toggle {
    font: normal normal normal 12px/1 bootstrap-icons;
    top: 2px;
    left: 2px;
  }

  .toggle.collapsed::after {
    content: "\F4FA";
  }

  .toggle.expanded::after {
    content: "\F2E6";
  }

  color: black;

  .root {
    padding: 0;
    margin: 0;
  }
`;
